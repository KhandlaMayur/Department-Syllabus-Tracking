import './states.css';

/**
 * Shown in place of a list/table/section when there is no data yet —
 * e.g. "No subjects assigned" before Phase 2 wires up real content.
 */
export default function EmptyState({
  title = 'Nothing here yet',
  message = 'Once data is added, it will show up here.',
  action,
}) {
  return (
    <div className="state-container">
      <div className="state-icon state-icon-empty">□</div>
      <h3 className="state-title">{title}</h3>
      <p className="text-muted state-label">{message}</p>
      {action}
    </div>
  );
}
