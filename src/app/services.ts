import { QueryClient } from '@tanstack/react-query';
import { createApi } from '../api/api';
import { ApiError, SessionExpiredError } from '../api/errors';
import { createSessionStore, type AnonymousReason } from '../auth/session-store';
import { API_BASE_URL } from '../config';
import { getFingerprint } from '../lib/fingerprint';

/** App-wide singletons. UI code reaches them only through hooks and auth actions. */

export const sessionStore = createSessionStore();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // API errors are deterministic (and 401 is already handled by the session guard),
      // so only network failures are worth retrying.
      retry: (failureCount, error) =>
        !(error instanceof ApiError || error instanceof SessionExpiredError) && failureCount < 2,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

/** Drops everything user-specific; the router guard then redirects to the login screen. */
export function endLocalSession(reason: AnonymousReason): void {
  queryClient.clear();
  sessionStore.setState({ status: 'anonymous', reason });
}

export const api = createApi({
  baseUrl: API_BASE_URL,
  fingerprint: getFingerprint(),
  // Only a live session can "expire": a 401 during startup restore or from a request
  // still in flight after logout must not show the "session expired" notice.
  onSessionExpired: () => {
    if (sessionStore.getState().status === 'authenticated') endLocalSession('expired');
  },
});
