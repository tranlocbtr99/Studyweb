const base = process.argv[2];
if (!base) throw new Error('HTTPS deployment URL is required');
const origin = new URL(base);
if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash) {
  throw new Error('Smoke test requires a clean HTTPS origin');
}
const root = origin.origin;
async function check(path, expectedType) {
  const response = await fetch(root + path, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes(expectedType)) throw new Error(`${path} returned unexpected content type: ${type}`);
  return response;
}
const health = await check('/api/v1/health', 'application/json');
const payload = await health.json();
if (payload.status !== 'ok' || payload.service !== 'studyweb-api') throw new Error('Unexpected API health payload');
const home = await check('/', 'text/html');
if (!(await home.text()).includes('<div id="root"')) throw new Error('React mount element missing');
console.log('HTTPS smoke test passed for API health and React entrypoint');
