import './states.css';

/**
 * Shown when a request fails. Pass `onRetry` to render a retry button
 * (e.g. re-run the query that failed).
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  onRetry,
}) {
  return (
    <div className="state-container">
      <div className="state-icon state-icon-error">!</div>
      <h3 className="state-title">{title}</h3>
      <p className="text-muted state-label">{message}</p>
      {onRetry && (
        <button className="btn btn-outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
