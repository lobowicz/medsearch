import React, { useState, useEffect, useMemo } from 'react';
import debounce from 'lodash.debounce';
import './SearchBar.css';

const SEARCH_ICON_URL = process.env.PUBLIC_URL + '/images/search-icon.svg';
const API_BASE = process.env.REACT_APP_API_BASE_URL;

export default function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Search for a medicine...'
}) {
  const [suggestions, setSuggestions]   = useState([]);
  const [loading, setLoading]           = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // 1) Debounced suggestions fetch (no deps needed)
  const fetchSuggestions = useMemo(() =>
    debounce(async (input) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/suggest?prefix=${encodeURIComponent(input)}`
        );
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Suggest fetch error:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
        setShowDropdown(true);
      }
    }, 300)
  , []);  // empty deps: API_BASE is static

  // 2) Trigger or cancel debounce on `value` changes
  useEffect(() => {
    if (value.trim().length >= 2) {
      fetchSuggestions(value.trim());
    } else {
      fetchSuggestions.cancel();
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
    }
  }, [value, fetchSuggestions]);

  // 3) Cleanup on unmount
  useEffect(() => () => fetchSuggestions.cancel(), [fetchSuggestions]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onSearch(value);
      setShowDropdown(false);
    }
  };

  const handleSelect = (sugg) => {
    onChange(sugg);
    setShowDropdown(false);
    onSearch(sugg);
  };

  return (
    <div className="search-bar-wrapper">
      <div className="search-bar">
        <input
          className="search-bar__input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          className="search-bar__button"
          onClick={() => {
            onSearch(value);
            setShowDropdown(false);
          }}
          aria-label="Search"
        >
          <img
            src={SEARCH_ICON_URL}
            alt="Search"
            className="search-bar__icon"
          />
        </button>
      </div>

      {showDropdown && (
        <div className="search-suggestions">
          {loading ? (
            <div className="search-suggestion-item">Loading...</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((sugg, i) => (
              <div
                key={i}
                className="search-suggestion-item"
                onMouseDown={() => handleSelect(sugg)}
              >
                {sugg}
              </div>
            ))
          ) : (
            <div className="search-suggestion-item">No matches found.</div>
          )}
        </div>
      )}
    </div>
  );
}
