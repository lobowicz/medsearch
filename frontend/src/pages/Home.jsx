import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    //             () => {console.warn('Geolocation failed — using default Kumasi coords');}
    //         );
    //     }
    // }, []); 
    
    // when the user submits a new search
    const handleSearch = async (term) => {
        if (!term.trim()) return;   // ignore empty searches 
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
        if (searchTerm) handleSearch(searchTerm);
    };

    return (
        <div className="home-container">
            <div className="left-panel">
                <SearchBar value={searchTerm} onChange={setSearchTerm} onSearch={handleSearch} />
                <RadiusSlider radius={radius} onChange={handleRadiusChange} />
                <div className="info-section">
                    <Link to="/" className="info-logo">
                        <img src={process.env.PUBLIC_URL + '/images/logo.png'} alt="MedSearch logo" />
                        <span>MedSearch</span>
                    </Link>
                    
                    <p className="info-text">
                        Search the name of a medicine and MedSearch will identify and highlight nearby pharmacies that
                        stock the drug AND accept Ghana’s National Health Insurance (NHIS) card for prescriptions. 
                        <br></br>
                        Adjust the search radius to your preference. 
                        <br></br>
                        Click on the pharmacy markers&nbsp;
                        <img src={process.env.PUBLIC_URL + '/images/pharm-icon.svg'} alt="Pharmacy icon" className="inline-icon" />
                        &nbsp;to get directions from your location&nbsp;
                        <img src={process.env.PUBLIC_URL + '/images/user-icon.svg'} alt="You icon" className="inline-icon" />. 
                    </p>
                    
                    <p className="info-thanks">
                        We're grateful to the Ghana NHIS, UNICEF Ghana, and Nirav Shah for the invaluable support in bringing this project to life.
                    </p>

                    <p className="info-contact">
                        Have feedback or questions? Email:&nbsp;
                        <a href="mailto:medsearchgh@gmail.com">medsearchgh@gmail.com</a>
                    </p>
                    
                    <div className="info-logos">
                        <img src={process.env.PUBLIC_URL + '/images/ghana-flag.png'} alt="Ghana flag" />
                        <img src={process.env.PUBLIC_URL + '/images/nhis-logo.png'} alt="NHIS logo" />
                        <img src={process.env.PUBLIC_URL + '/images/unicef-logo-2.png'} alt="UNICEF logo" />
                        <img src={process.env.PUBLIC_URL + '/images/logo.png'} alt="MedSearch logo" />
                    </div>
                    
                    <p className="info-disclaimer">
                        Currently covering regions in Ghana - more countries soon.
                    </p>
                </div>
            </div>

            <div className="map-panel">
                <div className="map-content">
                <MapView userLocation={userLocation} pharmacies={pharmacies}/>
                </div>
            </div>
        </div>
    );
}
