import '../../styles/admin.css';

/**
 * Labeled form field with validation.
 * type: 'input' | 'select' | 'textarea' | 'number'
 */
export default function FormField({
  label, required, error,
  type = 'input',
  children,      // for type='select' — pass <option> elements
  ...inputProps
}) {
  const cls = `form-field__${type === 'number' ? 'input' : type}${error ? ' error' : ''}`;

  return (
    <div className="form-field">
      {label && (
        <label className="form-field__label">
          {label}{required && <span className="required">*</span>}
        </label>
      )}
      {type === 'select' ? (
        <select className={cls} {...inputProps}>{children}</select>
      ) : type === 'textarea' ? (
        <textarea className="form-field__textarea" rows={3} {...inputProps} />
      ) : (
        <input
          className={cls}
          type={type === 'number' ? 'number' : type === 'email' ? 'email' : 'text'}
          {...inputProps}
        />
      )}
      {error && <span className="form-field__error">{error}</span>}
    </div>
  );
}
