import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import RadiusSlider from '../components/RadiusSlider';
import './Home.css';

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
        <div className="home-container">
            {/* Left Panel */}
            <div className="left-panel">
                <SearchBar value={searchTerm} onChange={setSearchTerm} onSearch={handleSearch} />
                <RadiusSlider radius={radius} onChange={handleRadiusChange} />
                {/* <ResultsList
                    pharmacies={results}
                    onHover={...}
                    onClick={...}
                /> */}
            </div>

            {/* Map Panel */}
            <div className="map-panel">
                <div className="map-content">
                Map will go here!
                </div>
            </div>
        </div>
    );
}
