import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { isApiError } from '../../api/errors';
import type { Credentials, FieldErrors } from '../../api/types';
import { login, useSession } from '../../auth/session';
import { TextField } from '../../components/TextField';
import { getErrorMessage } from '../../lib/error-message';
import { omitFieldError, unmatchedFieldErrors } from '../../lib/field-errors';
import { readStateString } from '../../lib/router-state';

const FIELDS = ['email', 'password'] as const;

export function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const [values, setValues] = useState<Credentials>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: login,
    onError: (error) => setFieldErrors(isApiError(error, 422) ? error.fieldErrors : {}),
  });

  if (session.status === 'authenticated') {
    return <Navigate to={readStateString(location.state, 'from') ?? '/webhooks'} replace />;
  }

  const handleChange = (field: keyof Credentials) => (event: { target: { value: string } }) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setFieldErrors((prev) => omitFieldError(prev, field));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate(values);
  };

  const formErrors = mutation.isError
    ? isApiError(mutation.error, 422)
      ? unmatchedFieldErrors(fieldErrors, FIELDS)
      : [getErrorMessage(mutation.error)]
    : [];

  return (
    <main className="auth-page">
      <form className="card" onSubmit={handleSubmit} noValidate>
        <h1>Вхід</h1>
        {session.status === 'anonymous' && session.reason === 'expired' && (
          <p className="notice">Сесія завершилась. Увійдіть знову.</p>
        )}

        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          value={values.email}
          onChange={handleChange('email')}
          errors={fieldErrors.email}
          autoFocus
        />
        <TextField
          label="Пароль"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange('password')}
          errors={fieldErrors.password}
        />

        {formErrors.length > 0 && <p className="form-error">{formErrors.join(' ')}</p>}

        <button type="submit" className="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Вхід…' : 'Увійти'}
        </button>
      </form>
    </main>
  );
}
