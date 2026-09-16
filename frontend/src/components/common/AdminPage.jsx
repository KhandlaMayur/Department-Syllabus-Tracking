import '../../styles/admin.css';

/**
 * Page shell used by all admin pages.
 * title, subtitle: heading text
 * action: primary button JSX (e.g. <button>Add</button>)
 * toolbar: extra filter/search bar content
 */
export default function AdminPage({ title, subtitle, action, toolbar, children }) {
  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div className="admin-page__title-group">
          <h1 className="admin-page__title">{title}</h1>
          {subtitle && <p className="admin-page__subtitle">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {toolbar && <div className="admin-toolbar">{toolbar}</div>}
      {children}
    </div>
  );
}
