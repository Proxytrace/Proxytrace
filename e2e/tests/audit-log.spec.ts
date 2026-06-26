import { test, expect } from '../helpers/fixtures';
import { ProxytraceApiClient } from '../helpers/api-client';

// The Audit Log records deliberate, user-attributed actions (who did what, to which target, in which
// project) asynchronously: LogAudit -> unbounded channel -> AuditWriter -> AuditLogEntryEntity row.
// These specs trigger real actions over the API, poll the audit API until the row is persisted, then
// assert the admin UI reflects it and that role-scoping/failure-capture behave as designed.
//
// Note: the per-test DB reset truncates AuditLogEntryEntity, so each test starts from an empty trail.
test.describe('Audit Log', () => {
  let api: ProxytraceApiClient;
  let endpointId: string;
  let projectId: string;

  test.beforeEach(async ({ request }) => {
    api = new ProxytraceApiClient(request);
    const { token } = await api.login('admin@e2e.test', 'E2ePassword1!');
    api.setToken(token);
    endpointId = await api.firstEndpointId();
    projectId = await api.firstProjectId();
  });

  // Audit persistence is eventually-consistent (background writer) — poll, never sleep.
  async function expectAudited(
    filter: { action?: string; targetId?: string },
    predicate: (e: Awaited<ReturnType<ProxytraceApiClient['getAuditLog']>>['items'][number]) => boolean,
    message: string,
  ) {
    await expect
      .poll(
        async () => (await api.getAuditLog({ pageSize: 100, ...filter })).items.some(predicate),
        { timeout: 30_000, intervals: [500, 1_000, 2_000], message },
      )
      .toBe(true);
  }

  test('records a project-scoped action and surfaces it in the admin UI', async ({ page }) => {
    const name = `E2E Audit Project ${Date.now()}`;
    const { id } = await api.createProject(name, endpointId);

    await expectAudited(
      { action: 'ProjectCreated' },
      (e) => e.targetLabel === name && e.projectId === id,
      'ProjectCreated was never recorded',
    );

    await page.goto('/settings/audit-log', { waitUntil: 'load' });
    await expect(page.getByTestId('settings-nav-audit-log')).toBeVisible();
    await expect(page.getByTestId('audit-log-table')).toBeVisible();

    const table = page.getByTestId('audit-log-table');
    await expect(table).toContainText('Project Created');
    await expect(table).toContainText(name);

    // Opening the row reveals the detail panel.
    await page.getByText(name).first().click();
    await expect(page.getByTestId('audit-log-detail')).toBeVisible();
  });

  test('records the new optimization, schedule, and deletion emitters', async () => {
    const stamp = Date.now();
    const agent = await api.createAgent({ name: `Audit Agent ${stamp}`, endpointId, projectId });
    const evaluator = await api.createEvaluator(projectId);
    const suite = await api.createTestSuite(`Audit Suite ${stamp}`, agent.id, [evaluator.id], [
      { userContent: 'ping', expectedContent: 'pong' },
    ]);

    // TestRunScheduleCreated (new emitter).
    const scheduleName = `Audit Schedule ${stamp}`;
    await api.createTestRunSchedule({
      name: scheduleName,
      testSuiteId: suite.id,
      modelEndpointIds: [endpointId],
      intervalMinutes: 60,
    });

    // TheorySubmitted (new emitter) — the submit audits immediately; A/B validation is background.
    await api.submitTheory({
      agentId: agent.id,
      suiteId: suite.id,
      proposedSystemMessage: `Rewritten prompt ${stamp}`,
      rationale: 'e2e audit coverage',
    });

    // AgentDeleted (existing emitter) on a throwaway agent so we don't disturb the suite/theory.
    const doomed = await api.createAgent({ name: `Audit Doomed ${stamp}`, endpointId, projectId });
    await api.deleteAgent(doomed.id);

    await expectAudited(
      { action: 'TestRunScheduleCreated' },
      (e) => e.targetLabel === scheduleName,
      'TestRunScheduleCreated was never recorded',
    );
    await expectAudited(
      { action: 'TheorySubmitted' },
      (e) => e.projectId === projectId,
      'TheorySubmitted was never recorded',
    );
    await expectAudited(
      { action: 'AgentDeleted', targetId: doomed.id },
      (e) => e.targetId === doomed.id,
      'AgentDeleted was never recorded',
    );
  });

  test('action filter returns only the requested action', async () => {
    const name = `E2E Filter Project ${Date.now()}`;
    await api.createProject(name, endpointId);

    // The reset baseline auto-provisions default evaluators on project create (EvaluatorCreated rows),
    // so the trail holds more than one action type — a real test of the filter.
    const filtered = await api.getAuditLog({ action: 'ProjectCreated', pageSize: 100 });
    expect(filtered.items.length).toBeGreaterThan(0);
    expect(filtered.items.every((e) => e.action === 'ProjectCreated')).toBe(true);
    expect(filtered.items.some((e) => e.targetLabel === name)).toBe(true);
  });

  test('records AccessDenied for a forbidden mutation and hides global rows from members', async ({
    request,
  }) => {
    const stamp = Date.now();
    const memberEmail = `audit-member-${stamp}@e2e.test`;
    const invite = await api.inviteUser(memberEmail, 'Member');
    const { token: memberToken } = await api.signup(invite.token, 'MemberPass1!');

    // A member calling an admin-only mutating endpoint is authenticated but forbidden -> 403.
    const denied = await request.post('/api/auth/invites', {
      headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      data: { email: `nope-${stamp}@e2e.test`, role: 'Member' },
    });
    expect(denied.status()).toBe(403);

    await expectAudited(
      { action: 'AccessDenied' },
      (e) => e.actorEmail === memberEmail && e.outcome === 'Failure',
      'AccessDenied was never recorded',
    );

    // The AccessDenied row is global (no project). A member must never see global rows — even though
    // an admin can. The member here belongs to no project, so their scoped view excludes it entirely.
    const memberApi = new ProxytraceApiClient(request);
    memberApi.setToken(memberToken);
    const memberView = await memberApi.getAuditLog({ pageSize: 100 });
    expect(memberView.items.every((e) => e.projectId !== null)).toBe(true);
    expect(memberView.items.some((e) => e.action === 'AccessDenied')).toBe(false);
  });
});
