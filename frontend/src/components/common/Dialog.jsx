import { useEffect, useRef } from 'react';
import '../../styles/admin.css';

/**
 * Modal dialog wrapper.
 * size: 'sm' | 'md' | 'lg'
 */
export default function Dialog({ open, title, onClose, size = 'md', children, footer }) {
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="dialog-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div
        className={`dialog dialog--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog__header">
          <h2 className="dialog__title" id="dialog-title">{title}</h2>
          <button className="dialog__close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  );
}
