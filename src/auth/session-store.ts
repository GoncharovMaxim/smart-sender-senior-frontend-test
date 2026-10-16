import type { User } from '../api/types';

export type AnonymousReason = 'expired' | 'logout' | null;

export type SessionState =
  | { status: 'unknown' }
  | { status: 'anonymous'; reason: AnonymousReason }
  | { status: 'authenticated'; user: User };

/** Minimal external store, consumed by React through useSyncExternalStore. */
export function createSessionStore(initial: SessionState = { status: 'unknown' }) {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState(next: SessionState) {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
