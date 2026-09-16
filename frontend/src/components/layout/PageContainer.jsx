import './Layout.css';

/**
 * Wraps page content with a consistent title/subtitle header and
 * max-width/padding. Every dashboard page should render its content
 * inside this so spacing stays consistent app-wide.
 */
export default function PageContainer({ title, subtitle, actions, children }) {
  return (
    <div className="page-container">
      {(title || actions) && (
        <div className="page-header">
          <div>
            {title && <h1 className="page-title">{title}</h1>}
            {subtitle && <p className="text-muted page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="page-actions">{actions}</div>}
        </div>
      )}
      <div className="page-content">{children}</div>
    </div>
  );
}
