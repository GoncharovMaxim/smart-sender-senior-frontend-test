import { createHttpClient } from './http';
import { createSessionGuard } from './session-guard';
import type {
  Credentials,
  LoginResponse,
  User,
  Webhook,
  WebhookInput,
  WebhookList,
  WebhookListParams,
} from './types';

/** The mock accepts any non-empty captcha token; a real widget would provide it here. */
const CAPTCHA_TOKEN_STUB = 'captcha-stub';

export interface ApiOptions {
  baseUrl: string;
  fingerprint: string;
  onSessionExpired: () => void;
}

export function createApi({ baseUrl, fingerprint, onSessionExpired }: ApiOptions) {
  const http = createHttpClient(baseUrl);
  const protectedHttp = createSessionGuard({
    http,
    rotate: () => http.request<void>('/auth/token/rotate', { method: 'POST', body: { fingerprint } }),
    onSessionExpired,
  });

  return {
    auth: {
      login: (credentials: Credentials) =>
        http.request<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { ...credentials, fingerprint },
          headers: { 'X-Captcha-Token': CAPTCHA_TOKEN_STUB },
        }),
      issue: (deviceSessionToken: string) =>
        http.request<void>('/auth/token/issue', {
          method: 'POST',
          body: { device_session_token: deviceSessionToken, fingerprint },
        }),
      revoke: () => http.request<void>('/auth/token/revoke', { method: 'POST', body: { fingerprint } }),
    },

    me: (signal?: AbortSignal) => protectedHttp.request<User>('/v1/me', { signal }),

    webhooks: {
      list: ({ page, limit, search }: WebhookListParams, signal?: AbortSignal) => {
        const query = new URLSearchParams({ page: String(page), limit: String(limit), search });
        return protectedHttp.request<WebhookList>(`/v1/webhooks?${query}`, { signal });
      },
      get: (id: number, signal?: AbortSignal) => protectedHttp.request<Webhook>(`/v1/webhooks/${id}`, { signal }),
      update: (id: number, input: WebhookInput) =>
        protectedHttp.request<Webhook>(`/v1/webhooks/${id}`, { method: 'PUT', body: input }),
    },
  };
}

export type Api = ReturnType<typeof createApi>;
