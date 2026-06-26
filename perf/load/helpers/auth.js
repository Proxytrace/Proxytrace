import http from 'k6/http';

// Window helpers shared by the load script: a 90-day window over the seeded data.
export function windowFrom() {
  return new Date(Date.now() - 90 * 86400000).toISOString();
}

export function windowTo() {
  return new Date().toISOString();
}

// Bootstraps (first run) or logs in the perf admin and returns a bearer token. The seeded database has
// no users, so the very first run takes the /api/auth/setup branch; reruns against a persisted volume
// fall through to /api/auth/login.
export function authenticate(baseUrl, email, password) {
  const mode = http.get(`${baseUrl}/api/auth/mode`);
  const setupRequired = mode.status === 200 && JSON.parse(mode.body).setupRequired === true;

  const body = JSON.stringify({ email, password });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = setupRequired
    ? http.post(`${baseUrl}/api/auth/setup`, body, params)
    : http.post(`${baseUrl}/api/auth/login`, body, params);

  if (res.status !== 200) {
    throw new Error(`auth failed (${setupRequired ? 'setup' : 'login'}): ${res.status} ${res.body}`);
  }
  const token = JSON.parse(res.body).token;
  if (!token) {
    throw new Error(`no token in auth response: ${res.body}`);
  }
  return token;
}

// Picks a real agent id (one with calls) from the dashboard breakdown, so the per-agent distribution
// endpoint exercises a populated agent rather than 404/empty.
export function discoverAgentId(baseUrl, token) {
  const res = http.get(
    `${baseUrl}/api/statistics/dashboard?from=${windowFrom()}&to=${windowTo()}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (res.status !== 200) {
    throw new Error(`dashboard probe failed: ${res.status} ${res.body}`);
  }
  const breakdown = JSON.parse(res.body).agentBreakdown || [];
  if (breakdown.length === 0) {
    throw new Error('dashboard returned no agents — seed the database before running the load test');
  }
  return breakdown[0].agentId;
}
