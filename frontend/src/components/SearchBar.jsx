import React from 'react';
import './SearchBar.css';

/**
 * the search bar props (properties):
 * - value: current input text
 * - onChange: callback to update input value
 * - onSearch: callback when user submits search
 */
const SEARCH_ICON_URL = process.env.PUBLIC_URL + '/images/search-icon.svg';

export default function SearchBar({ value, onChange, onSearch, placeholder='Search for a medicine...' }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onSearch(value);
        }
    };
    
    return (
        <div className="search-bar">
            <input
            className="search-bar__input" 
            type='text' 
            placeholder={placeholder}
            value={value} 
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            />
            <button 
            className="search-bar__button" 
            onClick={() => onSearch(value)} 
            aria-label='Search'>
                <img
                    src={SEARCH_ICON_URL}
                    alt="Search"
                    className="search-bar__icon"
                />
            </button>
        </div>
    );
}
