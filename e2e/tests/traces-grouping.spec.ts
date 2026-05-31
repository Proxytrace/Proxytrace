import { randomUUID } from 'crypto';
import { test, expect } from '@playwright/test';
import { ProxytraceApiClient } from '../helpers/api-client';

// Traces that share a conversationId (and appear more than once) collapse into one expandable
// ConversationGroupRow; everything else renders as a FlatTraceRow. The seed endpoint now accepts
// a conversationId, so we can produce a real multi-turn group without proxy ingestion.
test.describe('Trace conversation grouping', () => {
  let agentId: string;
  const conversationId = randomUUID();
  const turnIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    const endpointId = await api.firstEndpointId();
    agentId = (await api.createAgent({ name: `Grouping Agent ${Date.now()}`, endpointId })).id;

    // Two calls sharing one conversationId → a multi-turn ConversationGroup.
    for (let i = 1; i <= 2; i++) {
      const call = await api.seedAgentCall({
        agentId,
        conversationId,
        userContent: `turn ${i} question`,
        assistantContent: `turn ${i} answer`,
      });
      turnIds.push(call.id);
    }
  });

  test('multi-turn traces render as an expandable conversation group', async ({ page }) => {
    await page.goto('/traces', { waitUntil: 'load' });
    await expect(page.getByTestId('trace-table')).toBeVisible();

    const group = page.getByTestId(`conversation-group-row-${conversationId}`);
    await expect(group).toBeVisible();
    await expect(group).toContainText('2 turns');

    // Collapsed: child turn rows are not rendered until the group is expanded.
    await expect(page.getByTestId(`conversation-turn-${turnIds[0]}`)).toHaveCount(0);

    await group.click();
    for (const id of turnIds) {
      await expect(page.getByTestId(`conversation-turn-${id}`)).toBeVisible();
    }
  });
});
