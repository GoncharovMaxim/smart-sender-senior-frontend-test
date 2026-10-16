import type { ApiErrorType, ErrorBody, FieldErrors } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly type: ApiErrorType | 'UnknownException';
  readonly fieldErrors: FieldErrors;

  constructor(status: number, type: ApiError['type'], message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.type = type;
    this.fieldErrors = fieldErrors;
  }
}

/** The session could not be restored: rotate failed or the retried request got 401 again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

export async function parseApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  if (isErrorBody(body)) {
    const { type, message, payload } = body.error;
    return new ApiError(response.status, type, message, payload ?? {});
  }
  return new ApiError(response.status, 'UnknownException', `Request failed with status ${response.status}`);
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return typeof error === 'object' && error !== null && 'type' in error && 'message' in error;
}
