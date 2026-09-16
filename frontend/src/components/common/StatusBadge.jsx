import '../../styles/admin.css';

/** Status badge — shows Active / Inactive chip */
export default function StatusBadge({ active }) {
  return (
    <span className={`status-badge ${active ? 'status-badge--active' : 'status-badge--inactive'}`}>
      <span className="status-badge__dot" />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}
