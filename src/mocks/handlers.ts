import { delay, http, HttpResponse, type HttpResponseResolver } from 'msw';
import type { ApiErrorType, ErrorBody, FieldErrors, User, WebhookList } from '../api/types';
import { CSRF_TOKEN, SESSION_TTL_MS, type MockDb } from './db';

type ErrorStatus = 400 | 401 | 404 | 419 | 422;

const ERRORS: Record<ErrorStatus, { type: ApiErrorType; message: string }> = {
  400: { type: 'BadRequestException', message: 'Bad request.' },
  401: { type: 'AuthenticationException', message: 'Unauthenticated.' },
  404: { type: 'NotFoundException', message: 'Not found.' },
  419: { type: 'TokenMismatchException', message: 'CSRF token mismatch.' },
  422: { type: 'ValidationException', message: 'The given data was invalid.' },
};

export function errorResponse(status: ErrorStatus, payload?: FieldErrors) {
  const body: ErrorBody = { error: { ...ERRORS[status], ...(payload && { payload }) } };
  return HttpResponse.json(body, { status });
}

const FINGERPRINT_RE = /^[0-9a-f]{32}$/;
const DEFAULT_LIMIT = 10;

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Checks the CSRF token before the operation runs (POST / PUT). */
function withCsrf<P extends Record<string, string>>(resolver: HttpResponseResolver<P>): HttpResponseResolver<P> {
  return (info) =>
    info.request.headers.get('X-CSRF-TOKEN') === CSRF_TOKEN ? resolver(info) : errorResponse(419);
}

export function createHandlers({ baseUrl, db }: { baseUrl: string; db: MockDb }) {
  const url = (path: string) => `${baseUrl}${path}`;

  const hasActiveSession = () => db.session !== null && db.session.expiresAt > Date.now();
  const publicUser = (): User => {
    const { password: _password, ...user } = db.user;
    return user;
  };

  return [
    http.get(url('/csrf'), async () => {
      await delay();
      return new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': CSRF_TOKEN } });
    }),

    http.post(
      url('/auth/login'),
      withCsrf(async ({ request }) => {
        await delay();
        if (!request.headers.get('X-Captcha-Token')) return errorResponse(400);

        const body = await readBody(request);
        const email = asString(body.email).trim();
        const password = asString(body.password);
        const fingerprint = asString(body.fingerprint);

        const errors: FieldErrors = {};
        if (!email) errors.email = ['The email field is required.'];
        if (!password) errors.password = ['The password field is required.'];
        if (!FINGERPRINT_RE.test(fingerprint)) errors.fingerprint = ['The fingerprint is invalid.'];
        if (Object.keys(errors).length > 0) return errorResponse(422, errors);

        if (email.toLowerCase() !== db.user.email) {
          return errorResponse(422, { email: ['These credentials do not match our records.'] });
        }
        if (password !== db.user.password) {
          return errorResponse(422, { password: ['The provided password is incorrect.'] });
        }

        const token = crypto.randomUUID();
        db.deviceSessions.set(token, { userId: db.user.id, fingerprint });
        return HttpResponse.json({ device_session_token: token });
      }),
    ),

    http.post(
      url('/auth/token/issue'),
      withCsrf(async ({ request }) => {
        await delay();
        const body = await readBody(request);
        const token = asString(body.device_session_token);
        const device = db.deviceSessions.get(token);
        if (!device || device.fingerprint !== asString(body.fingerprint)) {
          return errorResponse(422, { device_session_token: ['The device session token is invalid.'] });
        }

        db.deviceSessions.delete(token);
        db.session = { userId: device.userId, fingerprint: device.fingerprint, expiresAt: Date.now() + SESSION_TTL_MS };
        return new HttpResponse(null, { status: 200 });
      }),
    ),

    http.post(
      url('/auth/token/rotate'),
      withCsrf(async ({ request }) => {
        await delay();
        const body = await readBody(request);
        if (!db.session || db.session.fingerprint !== asString(body.fingerprint)) return errorResponse(400);

        db.session.expiresAt = Date.now() + SESSION_TTL_MS;
        return new HttpResponse(null, { status: 200 });
      }),
    ),

    http.post(
      url('/auth/token/revoke'),
      withCsrf(async () => {
        await delay();
        db.session = null;
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.get(url('/v1/me'), async () => {
      await delay();
      if (!hasActiveSession()) return errorResponse(401);
      return HttpResponse.json(publicUser());
    }),

    http.get(url('/v1/webhooks'), async ({ request }) => {
      await delay();
      if (!hasActiveSession()) return errorResponse(401);

      const params = new URL(request.url).searchParams;
      const limit = Math.min(parsePositiveInt(params.get('limit'), DEFAULT_LIMIT), 100);
      const page = parsePositiveInt(params.get('page'), 1);
      const search = (params.get('search') ?? '').trim().toLowerCase();

      const filtered = search ? db.webhooks.filter((w) => w.name.toLowerCase().includes(search)) : db.webhooks;
      const body: WebhookList = {
        data: filtered.slice((page - 1) * limit, page * limit),
        paging: {
          pages: { current: page, last: Math.max(1, Math.ceil(filtered.length / limit)) },
          results: { total: filtered.length, limitation: limit },
        },
      };
      return HttpResponse.json(body);
    }),

    http.get(url('/v1/webhooks/:id'), async ({ params }) => {
      await delay();
      if (!hasActiveSession()) return errorResponse(401);

      const webhook = db.webhooks.find((w) => w.id === Number(params.id));
      return webhook ? HttpResponse.json(webhook) : errorResponse(404);
    }),

    http.put(
      url('/v1/webhooks/:id'),
      withCsrf(async ({ request, params }) => {
        await delay();
        if (!hasActiveSession()) return errorResponse(401);

        const webhook = db.webhooks.find((w) => w.id === Number(params.id));
        if (!webhook) return errorResponse(404);

        const body = await readBody(request);
        const name = asString(body.name).trim();
        const targetUrl = asString(body.url).trim();

        const errors: FieldErrors = {};
        if (!name) errors.name = ['The name field is required.'];
        else if (name.length > 255) errors.name = ['The name may not be greater than 255 characters.'];
        if (!targetUrl) errors.url = ['The url field is required.'];
        else if (!isHttpUrl(targetUrl)) errors.url = ['The url must be a valid URL.'];
        if (Object.keys(errors).length > 0) return errorResponse(422, errors);

        Object.assign(webhook, { name, url: targetUrl });
        return HttpResponse.json(webhook);
      }),
    ),
  ];
}
