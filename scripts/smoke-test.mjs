const base = process.argv[2];
if (!base) throw new Error('HTTPS deployment URL is required');
const origin = new URL(base);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
  throw new Error('Smoke test requires a clean HTTPS origin');
}
const root = origin.origin;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(path, expectedType) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await fetch(root + path, { redirect: 'error', signal: AbortSignal.timeout(15000), headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.includes(expectedType)) throw new Error(`${path} returned unexpected content type: ${type}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await pause(2000 * attempt);
    }
  }
  throw lastError;
}
const health = await check('/api/v1/health', 'application/json');
const payload = await health.json();
if (payload.status !== 'ok' || payload.service !== 'studyweb-api') throw new Error('Unexpected API health payload');
if (health.headers.get('x-content-type-options') !== 'nosniff') throw new Error('Missing API content-type protection');
const home = await check('/', 'text/html');
if (!(await home.text()).includes('id="root"')) throw new Error('React mount element missing');
console.log('HTTPS smoke test passed for API health, security header and React entrypoint');
