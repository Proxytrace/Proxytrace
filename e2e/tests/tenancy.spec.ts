import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Verifies multi-project tenancy isolation: agents created in one project must not be
// visible from another, both via the API's project-scoped list endpoint and via the UI's
// project switcher (which drives the project-scoped `/agents` query).
//
// Project A is the default 'E2E Test Project' created during setup; project B is created here.
test.describe('Tenancy isolation', () => {
  let api: ProxytraceApiClient;
  let projectA: string;
  let projectB: string;
  let agentA: { id: string; name: string };
  let agentB: { id: string; name: string };

  test.beforeAll(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);

    const endpointId = await api.firstEndpointId();
    projectA = await api.firstProjectId();

    const stamp = Date.now();
    const created = await api.createProject(`Tenancy Project B ${stamp}`, endpointId);
    projectB = created.id;

    agentA = await api.createAgent({ name: `Tenancy Agent A ${stamp}`, endpointId, projectId: projectA });
    agentB = await api.createAgent({ name: `Tenancy Agent B ${stamp}`, endpointId, projectId: projectB });
  });

  test.afterAll(async () => {
    // Best-effort cleanup so repeated runs don't accumulate projects/agents.
    try {
      await api.deleteAgent(agentA.id);
      await api.deleteAgent(agentB.id);
    } catch {
      // ignore — project deletion may already cascade
    }
    try {
      await api.deleteProject(projectB);
    } catch {
      // ignore
    }
  });

  test('API: agents are scoped to their project', async () => {
    const inA = await api.listAgentsPaged({ projectId: projectA, pageSize: 200 });
    const idsA = inA.items.map((a) => a.id);
    expect(idsA).toContain(agentA.id);
    expect(idsA).not.toContain(agentB.id);

    const inB = await api.listAgentsPaged({ projectId: projectB, pageSize: 200 });
    const idsB = inB.items.map((a) => a.id);
    expect(idsB).toContain(agentB.id);
    expect(idsB).not.toContain(agentA.id);
  });

  test('UI: project switcher scopes the agents list and does not leak', async ({ page }) => {
    // The active project is persisted in localStorage (`proxytrace:current-project-id`).
    // Force project A as the starting point so the test is independent of prior runs.
    await page.addInitScript((id) => {
      window.localStorage.setItem('proxytrace:current-project-id', id);
    }, projectA);

    await page.goto('/agents', { waitUntil: 'load' });
    await expect(page.getByTestId('agent-list')).toBeVisible();

    // Project A active: agent A visible, agent B not present.
    await expect(page.getByTestId(`agent-card-${agentA.id}`)).toBeVisible();
    await expect(page.getByTestId(`agent-card-${agentB.id}`)).toHaveCount(0);

    // Switch to project B via the switcher.
    await page.getByTestId('project-switcher').click();
    await page.getByTestId(`project-switcher-option-${projectB}`).click();

    // Now agent B is visible and agent A is gone (no cross-project leak).
    await expect(page.getByTestId(`agent-card-${agentB.id}`)).toBeVisible();
    await expect(page.getByTestId(`agent-card-${agentA.id}`)).toHaveCount(0);

    // Switch back to project A — assert the reverse holds.
    await page.getByTestId('project-switcher').click();
    await page.getByTestId(`project-switcher-option-${projectA}`).click();

    await expect(page.getByTestId(`agent-card-${agentA.id}`)).toBeVisible();
    await expect(page.getByTestId(`agent-card-${agentB.id}`)).toHaveCount(0);
  });
});
