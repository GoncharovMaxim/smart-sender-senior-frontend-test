import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: string[] | undefined;
}

export function TextField({ label, errors, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hasErrors = errors !== undefined && errors.length > 0;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={hasErrors} aria-describedby={hasErrors ? errorId : undefined} {...inputProps} />
      {hasErrors && (
        <p id={errorId} className="field-error">
          {errors.join(' ')}
        </p>
      )}
    </div>
  );
}
