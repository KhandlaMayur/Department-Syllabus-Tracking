import Dialog from './Dialog';

/** Confirmation dialog for actions (delete, complete, etc.) */
export default function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  loading,
  confirmText,
  confirmVariant = 'danger',
  loadingText,
}) {
  const btnClass = confirmVariant === 'success'
    ? 'btn-success'
    : confirmVariant === 'primary'
    ? 'btn-primary'
    : confirmVariant === 'danger'
    ? 'btn-danger'
    : 'btn-primary';

  const defaultBtnText = confirmVariant === 'danger' ? '🗑 Delete' : 'Confirm';
  const defaultLoadingText = confirmVariant === 'danger' ? 'Deleting…' : 'Processing…';

  return (
    <Dialog
      open={open}
      title={title || 'Confirm'}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className={btnClass} onClick={onConfirm} disabled={loading}>
            {loading ? (loadingText || defaultLoadingText) : (confirmText || defaultBtnText)}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--admin-text-muted)', margin: 0, lineHeight: 1.6 }}>
        {message || 'Are you sure you want to proceed?'}
      </p>
    </Dialog>
  );
}
