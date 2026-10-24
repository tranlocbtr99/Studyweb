export default {
  async fetch(request) {
    if (new URL(request.url).pathname !== '/probe') return new Response('Not found', { status: 404 });
    try {
      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('synthetic-worker-test-only'), 'PBKDF2', false, ['deriveBits']);
      const start = performance.now();
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, key, 256);
      return Response.json({ check: 'worker_pbkdf2_310000', passed: bits.byteLength === 32, elapsedMs: Math.round(performance.now() - start) });
    } catch (error) {
      return Response.json({ check: 'worker_pbkdf2_310000', passed: false, errorType: error instanceof Error ? error.name : 'unknown' }, { status: 503 });
    }
  }
};
