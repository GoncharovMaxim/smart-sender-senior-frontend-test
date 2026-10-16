import { http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb, MOCK_CREDENTIALS, type MockDb } from '../mocks/db';
import { createHandlers, errorResponse } from '../mocks/handlers';
import { createApi, type Api } from './api';
import { SessionExpiredError } from './errors';

const BASE_URL = 'http://api.test/api';
const FINGERPRINT = '0123456789abcdef0123456789abcdef';

interface LoggedResponse {
  method: string;
  path: string;
  status: number;
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

async function setup() {
  const db = createDb();
  server.use(...createHandlers({ baseUrl: BASE_URL, db }));

  const onSessionExpired = vi.fn();
  const api = createApi({ baseUrl: BASE_URL, fingerprint: FINGERPRINT, onSessionExpired });

  const { device_session_token } = await api.auth.login(MOCK_CREDENTIALS);
  await api.auth.issue(device_session_token);

  // Start logging only after sign-in so assertions see just the scenario under test.
  const log: LoggedResponse[] = [];
  server.events.on('response:mocked', ({ request, response }) => {
    const path = new URL(request.url).pathname.replace('/api', '');
    log.push({ method: request.method, path, status: response.status });
  });

  return { api, db, log, onSessionExpired };
}

function expireSession(db: MockDb) {
  if (!db.session) throw new Error('Expected an active session');
  db.session.expiresAt = Date.now() - 1;
}

const listFirstPage = (api: Api) => api.webhooks.list({ page: 1, limit: 10, search: '' });
const calls = (log: LoggedResponse[], path: string) => log.filter((entry) => entry.path === path);

describe('session guard', () => {
  it('shares one rotate between two parallel 401s and retries both requests', async () => {
    const { api, db, log, onSessionExpired } = await setup();
    expireSession(db);

    const [me, list] = await Promise.all([api.me(), listFirstPage(api)]);

    expect(me.email).toBe(MOCK_CREDENTIALS.email);
    expect(list.data).toHaveLength(10);
    expect(calls(log, '/auth/token/rotate')).toEqual([{ method: 'POST', path: '/auth/token/rotate', status: 200 }]);
    expect(calls(log, '/v1/me').map((entry) => entry.status)).toEqual([401, 200]);
    expect(calls(log, '/v1/webhooks').map((entry) => entry.status)).toEqual([401, 200]);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('ends the session when rotate fails', async () => {
    const { api, db, log, onSessionExpired } = await setup();
    db.session = null; // revoked on the server: rotate now answers 400

    const results = await Promise.allSettled([api.me(), listFirstPage(api)]);

    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(SessionExpiredError);
    }
    expect(calls(log, '/auth/token/rotate')).toHaveLength(1);
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('re-fetches the CSRF token on 419 and retries the request once', async () => {
    const { api, log } = await setup();
    server.use(http.put(`${BASE_URL}/v1/webhooks/:id`, () => errorResponse(419), { once: true }));

    const updated = await api.webhooks.update(1, { name: 'Renamed', url: 'https://example.com/hook' });

    expect(updated.name).toBe('Renamed');
    expect(log.map((entry) => `${entry.method} ${entry.path} ${entry.status}`)).toEqual([
      'PUT /v1/webhooks/1 419',
      'GET /csrf 204',
      'PUT /v1/webhooks/1 200',
    ]);
  });
});
