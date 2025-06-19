import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import RadiusSlider from '../components/RadiusSlider';

export default function Home() {
    // set up state hooks
    const [searchTerm, setSearchTerm] = useState('');
    const [radius, setRadius] = useState(10); // default rad = 10 km

    // when the user submits a new search
    const handleSearch = (term) => {
        console.log(`Searching for: ${term} within ${radius}km`);
        setSearchTerm(term);
        // TODO: trigger your API call here using `term`, `radius`, and geolocation
        // fetch(`${process.env.REACT_APP_API_BASE_URL}/api/search?medicine=${term}&lat=${userLocation.lat}&lng=${userLocation.lng}&radius=${radius}`)
        //   .then(res => res.json())
        //   .then(data => setResults(data.results));
    };

    // live update results when radius is changed
    const handleRadiusChange = (newRadius) => {
        setRadius(newRadius);
        if (searchTerm) {
            handleSearch(searchTerm);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            {/* Left Panel */}
            <div style={{ width: '25%', padding: '1rem', background: '#fafafa', boxSizing: 'border-box' }}>
                <SearchBar value={searchTerm} onChange={setSearchTerm} onSearch={handleSearch} />
                <RadiusSlider radius={radius} onChange={handleRadiusChange} />
                {/* <ResultsList
                    pharmacies={results}
                    onHover={...}
                    onClick={...}
                /> */}
            </div>

            {/* Map Panel */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ width: '100%', height: '100%', display: 'flex', background: '#e0e0e0', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                Map will go here!
                </div>
            </div>
        </div>
    );
}
