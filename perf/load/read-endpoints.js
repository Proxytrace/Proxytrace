import http from 'k6/http';
import { check } from 'k6';
import { authenticate, discoverAgentId, windowFrom, windowTo } from './helpers/auth.js';

// The same absolute budgets the DB-layer + benchmark scopes use. k6 thresholds map 1:1 onto them and
// set the process exit code, so a breached p95 fails the run.
const budgets = JSON.parse(open('../perf-budgets.json')).httpP95Ms;

const BASE = __ENV.BASE_URL || 'http://localhost:5230';
const EMAIL = __ENV.ADMIN_EMAIL || 'perf-admin@proxytrace.dev';
const PASSWORD = __ENV.ADMIN_PASSWORD || 'PerfAdmin123!';

export const options = {
  scenarios: {
    read: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 10),
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'],
    'http_req_duration{name:dashboard}': [`p(95)<${budgets.statisticsDashboard}`],
    'http_req_duration{name:agentCallsList}': [`p(95)<${budgets.agentCallsList}`],
    'http_req_duration{name:agentDistributions}': [`p(95)<${budgets.agentDistributions}`],
  },
};

export function setup() {
  const token = authenticate(BASE, EMAIL, PASSWORD);
  const agentId = discoverAgentId(BASE, token);
  return { token, agentId };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };
  const from = windowFrom();
  const to = windowTo();
  const roll = Math.random();

  if (roll < 0.34) {
    const res = http.get(`${BASE}/api/statistics/dashboard?from=${from}&to=${to}`,
      { headers, tags: { name: 'dashboard' } });
    check(res, { 'dashboard 200': (r) => r.status === 200 });
  } else if (roll < 0.67) {
    const res = http.get(`${BASE}/api/agent-calls?page=1&pageSize=50`,
      { headers, tags: { name: 'agentCallsList' } });
    check(res, { 'agent-calls 200': (r) => r.status === 200 });
  } else {
    const res = http.get(`${BASE}/api/statistics/agents/${data.agentId}/distributions?from=${from}&to=${to}`,
      { headers, tags: { name: 'agentDistributions' } });
    check(res, { 'distributions 200': (r) => r.status === 200 });
  }
}

// Persist a machine-readable summary next to the other scopes' results (path is relative to the repo
// root, where run.sh / the workflow invoke k6).
export function handleSummary(data) {
  return {
    'perf/results/k6-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const lines = ['', 'k6 HTTP load test summary', '-'.repeat(60)];
  const metrics = data.metrics || {};
  for (const name of ['dashboard', 'agentCallsList', 'agentDistributions']) {
    const m = metrics[`http_req_duration{name:${name}}`] || metrics['http_req_duration'];
    const p95 = m && m.values ? m.values['p(95)'] : undefined;
    lines.push(`${name.padEnd(22)} p95=${p95 !== undefined ? p95.toFixed(1) + 'ms' : 'n/a'}`);
  }
  const failed = metrics.http_req_failed;
  if (failed && failed.values) {
    lines.push(`error rate            ${(failed.values.rate * 100).toFixed(2)}%`);
  }
  lines.push('-'.repeat(60), '');
  return lines.join('\n');
}
