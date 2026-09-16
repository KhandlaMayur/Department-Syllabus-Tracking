import { useRef, useEffect } from 'react';
import '../../styles/admin.css';

/** Debounced search input */
export default function SearchBar({ value, onChange, placeholder = 'Search…', debounce = 350 }) {
  const timer = useRef(null);
  const handleChange = (e) => {
    clearTimeout(timer.current);
    const v = e.target.value;
    timer.current = setTimeout(() => onChange(v), debounce);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="search-bar">
      <svg className="search-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        type="text"
        className="search-bar__input"
        placeholder={placeholder}
        defaultValue={value}
        onChange={handleChange}
      />
    </div>
  );
}
