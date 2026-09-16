import '../../styles/admin.css';

/**
 * FilterBar renders a row of <select> dropdowns.
 * filters: [{ key, label, options: [{ value, label }] }]
 * values: { [key]: value }
 */
export default function FilterBar({ filters, values, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {filters.map(f => (
        <select
          key={f.key}
          className="filter-select"
          value={values[f.key] || ''}
          onChange={e => onChange(f.key, e.target.value)}
          aria-label={f.label}
        >
          <option value="">{f.label}</option>
          {f.options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}
