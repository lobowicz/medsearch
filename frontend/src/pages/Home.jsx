import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import RadiusSlider from '../components/RadiusSlider';
import MapView from '../components/MapView';
import './Home.css';

export default function Home() {
    // set up state hooks
    const [searchTerm, setSearchTerm] = useState('');  // term to search for
    const [radius, setRadius] = useState(10); // default rad = 10 km
    const [pharmacies, setPharmacies] = useState([]);
    const [userLocation, setUserLocation] = useState({ lat: 6.688, lng: -1.642 }); // default to Kumasi if geolocation fails

    // attempt browser geolocation
    // useEffect(() => {
    //     if (navigator.geolocation) {
    //         navigator.geolocation.getCurrentPosition(
    //             ({ coords }) => setUserLocation({ lat: coords.latitude, lng: coords.longitude }),
    //             () => {
    //                 console.warn('Geolocation failed — using default Kumasi coords');
    //                 }); // keeps default
    //     }
    // }, []); 
    
    // when the user submits a new search
    const handleSearch = async (term) => {
        setSearchTerm(term);
        try {
            const res = await fetch(
                `${process.env.REACT_APP_API_BASE_URL}/api/search` +
                `?medicine=${encodeURIComponent(term)}` +
                `&lat=${userLocation.lat}` +
                `&lng=${userLocation.lng}` +
                `&radius=${radius}`
            );
            const data = await res.json();
            setPharmacies(data.results); // assume data.results is our array of { pharmacy_id, name, address, lat, lng, distance_km }
        } catch (err) {
            console.error('Error fetching pharmacies: ', err);
        }
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
                <MapView userLocation={userLocation} pharmacies={pharmacies}/>
                </div>
            </div>
        </div>
    );
}
