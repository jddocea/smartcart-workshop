import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { handleChat } from './server/chat-handler';
import { SmartCartEnv } from './server/env';

const angularApp = new AngularAppEngine({
  // It is safe to set allow `localhost`, so that SSR can run in local development,
  // as, in production, Cloudflare will ensure that `localhost` is not the host.
  allowedHosts: ['localhost', '127.0.0.1'],
});

async function route(request: Request, env: SmartCartEnv): Promise<Response> {
  if (new URL(request.url).pathname === '/api/chat') {
    return handleChat(request, env);
  }

  return (await angularApp.handle(request)) ?? new Response('Page not found.', { status: 404 });
}

// The Angular dev server (ng serve) has no Worker env, so read process.env instead.
const devEnv = (): SmartCartEnv => {
  const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  return {
    GEMINI_API_KEY: env['GEMINI_API_KEY'],
    GEMINI_MODEL: env['GEMINI_MODEL'],
    SMARTCART_PROVIDER: env['SMARTCART_PROVIDER'],
  };
};

/**
 * This is a request handler used by the Angular CLI (dev-server and during build).
 */
export const reqHandler = createRequestHandler((request) => route(request, devEnv()));

export default {
  fetch: (request: Request, env: SmartCartEnv) => route(request, env),
};
