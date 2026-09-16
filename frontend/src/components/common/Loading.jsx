import './states.css';

/**
 * Generic loading indicator. Use `fullScreen` for page-level loads and
 * the default inline size for loading inside a card or table section.
 */
export default function Loading({ label = 'Loading...', fullScreen = false }) {
  return (
    <div className={`state-container ${fullScreen ? 'state-fullscreen' : ''}`}>
      <div className="spinner" role="status" aria-label="Loading" />
      <p className="text-muted state-label">{label}</p>
    </div>
  );
}
