import { ApiError, SessionExpiredError } from '../api/errors';

export function getErrorMessage(error: unknown): string {
  if (error instanceof SessionExpiredError) return 'Сесія завершилась. Увійдіть знову.';
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Не вдалося зʼєднатися з сервером.';
  return 'Щось пішло не так.';
}
