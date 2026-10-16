import type { FieldErrors } from '../api/types';

export function omitFieldError(errors: FieldErrors, field: string): FieldErrors {
  if (!(field in errors)) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}

/** Messages for fields the form does not render (e.g. `fingerprint`), shown as a form-level error. */
export function unmatchedFieldErrors(errors: FieldErrors, fields: readonly string[]): string[] {
  return Object.entries(errors)
    .filter(([field]) => !fields.includes(field))
    .flatMap(([, messages]) => messages);
}
