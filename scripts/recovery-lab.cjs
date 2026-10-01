// Run only against the separate profile-recovery-lab Compose project.
const { execFileSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:3001';
const report = { startedAt: new Date().toISOString(), checks: [] };
let stopped = false;
function compose(...args) {
  return execFileSync('docker', ['compose', '-p', 'profile-recovery-lab', '-f', 'compose.lab.yaml', ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], timeout: 180000,
  }).trim();
}
async function request(route, options = {}) {
  const response = await fetch(base + route, { ...options, signal: AbortSignal.timeout(7000) });
  return { status: response.status, body: await response.json() };
}
async function waitReady() {
  const start = performance.now();
  while (performance.now() - start < 90000) {
    try { if ((await request('/api/ready')).status === 200) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Database did not become ready within 90 seconds.');
}
function passed(message) { report.checks.push(message); console.log('PASS: ' + message); }
async function main() {
  const appId = compose('ps', '-q', 'app');
  assert.ok(appId, 'Start the lab first.');
  const appState = JSON.parse(execFileSync('docker', ['inspect', appId], { encoding: 'utf8' }))[0];
  assert.equal(appState.Config.Labels['com.docker.compose.project'], 'profile-recovery-lab');
  assert.ok(appState.NetworkSettings.Ports['3000/tcp'].some(port => port.HostIp === '127.0.0.1' && port.HostPort === '3001'));
  await waitReady();
  const profile = { name: 'Docker Recovery Demo', email: 'demo@example.com', interests: 'Volumes and recovery' };
  const put = body => request('/api/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await put(profile)).status, 200);
  assert.equal((await put({ ...profile, email: 'invalid' })).status, 400);
  assert.equal((await request('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
  assert.equal((await request('/api/missing')).status, 404);
  passed('Profile saved; invalid email and malformed JSON rejected; unknown API returns 404.');
  const saved = (await request('/api/profile')).body;
  stopped = true;
  compose('stop', 'mongodb');
  assert.equal((await request('/api/health')).status, 200);
  assert.equal((await request('/api/ready')).status, 503);
  assert.equal((await request('/api/profile')).status, 503);
  const page = await fetch(base, { signal: AbortSignal.timeout(7000) });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="profile-form"/);
  assert.equal((await put({ ...profile, name: 'Must not be saved' })).status, 503);
  passed('During outage: Node and webpage available (200); readiness, profile read, and save fail (503).');
  // Health status is sampled separately from the browser/API status.
  const deadline = Date.now() + 30000;
  let health;
  do {
    health = JSON.parse(execFileSync('docker', ['inspect', appId], { encoding: 'utf8' }))[0].State.Health.Status;
    if (health === 'unhealthy') break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (Date.now() < deadline);
  assert.equal(health, 'unhealthy');
  passed('Docker health check marks the app unhealthy during the outage.');
  const recoveryStart = performance.now();
  compose('start', 'mongodb');
  stopped = false;
  await waitReady();
  report.recoverySeconds = Number(((performance.now() - recoveryStart) / 1000).toFixed(2));
  assert.deepEqual((await request('/api/profile')).body, saved);
  assert.equal((await put(profile)).status, 200);
  const recovered = (await request('/api/profile')).body;
  passed('Original data survived; saving works again.');
  const oldDatabaseId = compose('ps', '-q', 'mongodb');
  compose('up', '-d', '--no-deps', '--force-recreate', 'mongodb');
  await waitReady();
  assert.notEqual(compose('ps', '-q', 'mongodb'), oldDatabaseId);
  assert.deepEqual((await request('/api/profile')).body, recovered);
  const after = JSON.parse(execFileSync('docker', ['inspect', appId], { encoding: 'utf8' }))[0];
  assert.equal(after.Id, appState.Id);
  assert.equal(after.State.StartedAt, appState.State.StartedAt);
  assert.equal(after.RestartCount, appState.RestartCount);
  passed('Database container replaced; volume data persisted; app process did not restart.');
  report.result = 'passed';
}
main().catch(error => {
  report.result = 'failed';
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => {
  if (stopped) {
    try { compose('start', 'mongodb'); } catch { console.error('Start the lab MongoDB manually using the guide.'); }
  }
  report.finishedAt = new Date().toISOString();
  mkdirSync(path.join(root, 'lab-results'), { recursive: true });
  writeFileSync(path.join(root, 'lab-results', 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('Results: lab-results/latest.json');
  if (report.recoverySeconds !== undefined) console.log(`Observed recovery: ${report.recoverySeconds}s (includes docker compose start and polling).`);
});
