export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  name: string;
}

export interface Webhook {
  id: number;
  name: string;
  url: string;
  active: boolean;
  created_at: string;
}

export interface Paging {
  pages: { current: number; last: number };
  results: { total: number; limitation: number };
}

export interface WebhookList {
  data: Webhook[];
  paging: Paging;
}

export interface WebhookListParams {
  page: number;
  limit: number;
  search: string;
}

export type WebhookInput = Pick<Webhook, 'name' | 'url'>;

export interface Credentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  device_session_token: string;
}

export type ApiErrorType =
  | 'BadRequestException'
  | 'AuthenticationException'
  | 'NotFoundException'
  | 'TokenMismatchException'
  | 'ValidationException';

/** Field name → list of messages, as in the 422 `payload`. */
export type FieldErrors = Record<string, string[]>;

export interface ErrorBody {
  error: {
    type: ApiErrorType;
    message: string;
    payload?: FieldErrors;
  };
}
