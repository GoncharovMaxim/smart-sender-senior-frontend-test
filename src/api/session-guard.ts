import { isApiError, SessionExpiredError } from './errors';
import type { HttpClient } from './http';

interface SessionGuardOptions {
  http: HttpClient;
  /** Extends the server session. Called through the raw client, so it never triggers itself. */
  rotate: () => Promise<void>;
  /** Rotate failed or the retried request got 401 again. */
  onSessionExpired: () => void;
}

/**
 * Wraps the transport for protected endpoints: on 401 rotates the session and retries once.
 *
 * - All requests that fail with 401 while a rotate is in flight wait for that same rotate.
 * - `generation` grows with every successful rotate. A request that was sent before the last
 *   rotate and still got 401 (its response arrived late) is retried without a new rotate.
 * - Requests started during a rotate wait for it first instead of hitting a known-dead session.
 */
export function createSessionGuard({ http, rotate, onSessionExpired }: SessionGuardOptions): HttpClient {
  let generation = 0;
  let rotation: Promise<void> | null = null;

  function rotateShared(): Promise<void> {
    rotation ??= rotate()
      .then(() => {
        generation += 1;
      })
      .finally(() => {
        rotation = null;
      });
    return rotation;
  }

  function expire(): never {
    onSessionExpired();
    throw new SessionExpiredError();
  }

  return {
    async request<T>(path: string, options?: Parameters<HttpClient['request']>[1]): Promise<T> {
      if (rotation) {
        try {
          await rotation;
        } catch {
          return expire();
        }
      }

      const sentAt = generation;
      try {
        return await http.request<T>(path, options);
      } catch (error) {
        if (!isApiError(error, 401)) throw error;
      }

      if (sentAt === generation) {
        try {
          await rotateShared();
        } catch {
          return expire();
        }
      }

      try {
        return await http.request<T>(path, options);
      } catch (error) {
        if (isApiError(error, 401)) return expire();
        throw error;
      }
    },
  };
}
