import { useState, type ChangeEvent, type FormEvent } from 'react';
import { isApiError } from '../../api/errors';
import type { FieldErrors, Webhook, WebhookInput } from '../../api/types';
import { TextField } from '../../components/TextField';
import { getErrorMessage } from '../../lib/error-message';
import { omitFieldError, unmatchedFieldErrors } from '../../lib/field-errors';
import { useUpdateWebhook } from './queries';

const FIELDS = ['name', 'url'] as const;

interface WebhookFormProps {
  webhook: Webhook;
  onSaved: () => void;
  onCancel: () => void;
}

/** Validation is server-side only: 422 field errors are shown next to the fields. */
export function WebhookForm({ webhook, onSaved, onCancel }: WebhookFormProps) {
  const update = useUpdateWebhook(webhook.id);
  const [values, setValues] = useState<WebhookInput>({ name: webhook.name, url: webhook.url });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleChange = (field: keyof WebhookInput) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => omitFieldError(prev, field));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(values, {
      onSuccess: onSaved,
      onError: (error) => setFieldErrors(isApiError(error, 422) ? error.fieldErrors : {}),
    });
  };

  const formErrors = update.isError
    ? isApiError(update.error, 422)
      ? unmatchedFieldErrors(fieldErrors, FIELDS)
      : [getErrorMessage(update.error)]
    : [];

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <TextField label="Назва" value={values.name} onChange={handleChange('name')} errors={fieldErrors.name} />
      <TextField label="URL" type="url" value={values.url} onChange={handleChange('url')} errors={fieldErrors.url} />

      {formErrors.length > 0 && (
        <p className="form-error" role="alert">
          {formErrors.join(' ')}
        </p>
      )}

      <div className="actions">
        <button type="button" onClick={onCancel} disabled={update.isPending}>
          Скасувати
        </button>
        <button type="submit" className="primary" disabled={update.isPending}>
          {update.isPending ? 'Збереження…' : 'Зберегти'}
        </button>
      </div>
    </form>
  );
}
