import { useSyncExternalStore } from 'react';
import type { Credentials } from '../api/types';
import { api, endLocalSession, sessionStore } from '../app/services';

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState);
}

/** login → issue (device token lives only in this closure) → /v1/me. */
export async function login(credentials: Credentials): Promise<void> {
  const { device_session_token } = await api.auth.login(credentials);
  await api.auth.issue(device_session_token);
  const user = await api.me();
  sessionStore.setState({ status: 'authenticated', user });
}

export async function logout(): Promise<void> {
  try {
    await api.auth.revoke();
  } catch {
    // The local session ends regardless of the server answer.
  } finally {
    endLocalSession('logout');
  }
}

/** On startup: with a real HttpOnly cookie the server session may still be alive. */
export async function restoreSession(): Promise<void> {
  try {
    const user = await api.me();
    sessionStore.setState({ status: 'authenticated', user });
  } catch {
    endLocalSession(null);
  }
}
