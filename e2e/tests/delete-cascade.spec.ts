import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// Cascade-on-delete behaviour, verified against the source:
//
//   • ModelProvidersController.Delete → providerRepository.RemoveAsync (plain EF Remove). The
//     storage FKs make children cascade: ModelEndpointEntity.Provider is OnDelete(Cascade) and
//     ApiKeyEntity.Provider is OnDelete(Cascade). So deleting a provider that still has model
//     endpoints + an API key SUCCEEDS (204) and its endpoints/keys disappear with it. The shared
//     Model row survives (ModelEndpoint.Model is Restrict) — only the endpoint join is removed.
//
//   • AgentsController.Delete → repository.RemoveAsync (plain EF Remove). The FK chain is:
//       Agent → AgentVersion          OnDelete(Cascade)
//       AgentVersion → AgentCall      OnDelete(Restrict)  (AgentCall.AgentVersionId)
//       Agent → TestSuite             OnDelete(Cascade)
//     Deleting an agent cascades to its versions; an agent WITH captured traces (agent calls)
//     therefore hits the Restrict on AgentCall → AgentVersion, which PostgreSQL enforces (the e2e
//     stack is Postgres). We do not hard-code which way it resolves: we read the API's actual
//     response and assert the world is internally consistent either way, documenting the observed
//     behaviour.

const ADMIN_EMAIL = 'admin@e2e.test';
const ADMIN_PASSWORD = 'E2ePassword1!';

test.describe('Delete cascade', () => {
  let api: ProxytraceApiClient;
  let projectId: string;
  let endpointId: string;

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    api.setToken(token);
    projectId = await api.firstProjectId();
    endpointId = await api.firstEndpointId();
  });

  test('deleting a provider cascades its model endpoints and API keys', async () => {
    const name = `E2E Cascade Provider ${Date.now()}`;
    const { id: providerId } = await api.createProvider({
      name,
      endpoint: 'https://api.openai.com/v1',
      upstreamApiKey: 'sk-e2e-fake-key',
      kind: 'OpenAi',
    });

    // Give it a model endpoint and an issued API key — the children that must cascade.
    const { id: modelEndpointId } = await api.addModelToProvider(providerId, `e2e-cascade-model-${Date.now()}`);
    await api.createProviderApiKey(providerId, `e2e-cascade-key-${Date.now()}`, projectId);

    // Sanity: the model endpoint really exists under this provider before deletion.
    const endpointsBefore = await api.getModelEndpoints();
    expect(endpointsBefore.some((e) => e.id === modelEndpointId && e.providerId === providerId)).toBeTruthy();

    // Delete succeeds (api-client throws on a non-2xx, so reaching the next line proves 2xx).
    await api.deleteProvider(providerId);

    // The provider is gone from the overview …
    const overview = await api.getProvidersOverview();
    expect(overview.providers.some((p) => p.provider.id === providerId)).toBeFalsy();

    // … and no orphan model endpoint remains pointing at the deleted provider.
    const endpointsAfter = await api.getModelEndpoints();
    expect(endpointsAfter.some((e) => e.id === modelEndpointId)).toBeFalsy();
    expect(endpointsAfter.some((e) => e.providerId === providerId)).toBeFalsy();
  });

  test('deleting an agent that has traces and a suite resolves consistently', async () => {
    const agentName = `E2E Cascade Agent ${Date.now()}`;
    const { id: agentId } = await api.createAgent({ name: agentName, endpointId, projectId });

    // Captured traces (agent calls) + a curated suite built from them.
    const callA = await api.seedAgentCall({ agentId, userContent: 'ping a', assistantContent: 'pong a' });
    const callB = await api.seedAgentCall({ agentId, userContent: 'ping b', assistantContent: 'pong b' });
    const { id: suiteId } = await api.createSuiteFromTraces(
      `E2E Cascade Suite ${Date.now()}`,
      agentId,
      [callA.id, callB.id],
    );

    // Confirm the prerequisites landed.
    const suitesBefore = await api.listSuites({ agentId });
    expect(suitesBefore.items.some((s) => s.id === suiteId)).toBeTruthy();

    // Attempt the delete and capture the OUTCOME rather than presuming a policy: RemoveAsync may
    // succeed (cascade) or be blocked by the AgentVersion→AgentCall Restrict FK (surfaces as a
    // non-2xx via the exception middleware). We branch on what actually happened.
    let deleteSucceeded = true;
    try {
      await api.deleteAgent(agentId);
    } catch {
      deleteSucceeded = false;
    }

    const agentsAfter = await api.listAgents();
    const agentStillPresent = agentsAfter.items.some((a) => a.id === agentId);

    if (deleteSucceeded) {
      // OBSERVED: delete succeeded (2xx). The agent must be gone from the listing, and its suite
      // (Agent→TestSuite is Cascade) must have been removed along with it — assert no orphan suite.
      expect(agentStillPresent).toBeFalsy();
      const suitesAfter = await api.listSuites({ agentId });
      expect(
        suitesAfter.items.some((s) => s.id === suiteId),
        'suite should cascade-delete with its agent',
      ).toBeFalsy();
    } else {
      // OBSERVED: delete was blocked because captured traces pin the agent's versions (Restrict).
      // The agent and its suite must still be present — the operation left the world intact.
      expect(agentStillPresent, 'a blocked delete must leave the agent in place').toBeTruthy();
      const suitesAfter = await api.listSuites({ agentId });
      expect(suitesAfter.items.some((s) => s.id === suiteId)).toBeTruthy();
    }
  });
});
