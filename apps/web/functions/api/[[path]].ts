const UPSTREAM = 'https://studyweb-api.tranlocbtr99.workers.dev';

interface Env {}
interface PagesContext {
  request: Request;
}

export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  const incomingUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);

  // Preserve the existing API's same-origin CSRF contract.
  if (isWrite && origin !== incomingUrl.origin) {
    return Response.json(
      { error: { code: 'CSRF_REJECTED', message: 'Origin check failed' } },
      { status: 403 }
    );
  }

  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, UPSTREAM);
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('cf-connecting-ip');
  headers.delete('x-forwarded-for');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-proto');
  if (origin === incomingUrl.origin) headers.set('Origin', new URL(UPSTREAM).origin);

  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    // Required for streamed uploads in the Workers runtime.
    ...(request.body ? { duplex: 'half' } : {})
  } as RequestInit);

  const response = await fetch(upstreamRequest);
  const responseHeaders = new Headers(response.headers);
  // A response should never be cached by a shared CDN when cookies are involved.
  responseHeaders.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
};
