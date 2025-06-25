import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

// static urls for marker icons 
const USER_ICON_URL  = process.env.PUBLIC_URL + '/images/user-icon.svg';
const PHARM_ICON_URL = process.env.PUBLIC_URL + '/images/pharm-icon.svg';

// container and default options
const containerStyle = { width: '100%', height: '100%' };
const DEFAULT_ZOOM    = 15;
const libraries       = ['places'];

export default function MapView({ userLocation, pharmacies }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });  

  const [map, setMap] = useState(null);
  // Store custom marker instances & their data
  const markersRef = useRef([]);
  // State for the currently selected pharmacy info window
  const [selectedPharmacy, setSelectedPharmacy] = useState(null);

  // onLoad callback for GoogleMap
  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    mapInstance.panTo(userLocation);
    mapInstance.setZoom(DEFAULT_ZOOM);
  }, [userLocation]);

  useEffect(() => {
    if (!isLoaded || !map) return;

    // 1) Clear existing markers
    markersRef.current.forEach(({ marker }) => {
      try { marker.setMap(null); }
      catch (err) { console.error('Error clearing marker:', err); }
    });
    markersRef.current = [];
    // Also reset any open InfoWindow
    setSelectedPharmacy(null);

    if (!pharmacies.length) return;

    // 2) Limit to 30 closest
    const topList = [...pharmacies]
      .sort((a,b)=>a.distance_km - b.distance_km)
      .slice(0,30);

    const service = new window.google.maps.places.PlacesService(map);
    let completed = 0;

    topList.forEach((pharm, idx) => {
      const query = `${pharm.name} ${pharm.address}`;
      try {
        service.findPlaceFromQuery(
          { query, fields:['place_id','geometry'] },
          (results, status) => {
            completed += 1;
            if (status === window.google.maps.places.PlacesServiceStatus.OK
                && results && results[0]) {
              try {
                const place = results[0];
                // Create custom marker
                const marker = new window.google.maps.Marker({
                  map,
                  position: place.geometry.location,
                  icon:{
                    url: PHARM_ICON_URL,
                    scaledSize: new window.google.maps.Size(36,36)
                  }
                });

                // On click, fetch place details and show InfoWindow
                marker.addListener('click', () => {
                  const detailService = new window.google.maps.places.PlacesService(map);
                  detailService.getDetails(
                    {
                      placeId: place.place_id,
                      fields:['name','formatted_address']
                    },
                    (placeInfo, st) => {
                      if (st === window.google.maps.places.PlacesServiceStatus.OK) {
                        setSelectedPharmacy({
                          pharmacy: pharm,
                          position: place.geometry.location,
                          placeInfo
                        });
                      }
                    }
                  );
                });

                // Save for cleanup
                markersRef.current.push({ marker, pharm });

              } catch(mkErr){
                console.error('Error creating marker for',pharm, mkErr);
              }
            } else {
              console.warn('Places lookup failed for', pharm.name, status);
            }

            // after all processed, adjust viewport
            if (completed === topList.length && markersRef.current.length) {
              try {
                const bounds = new window.google.maps.LatLngBounds();
                bounds.extend(userLocation);
                const pos = markersRef.current[0].marker.getPosition();
                bounds.extend(pos);
                map.fitBounds(bounds,50);
              } catch(bErr){
                console.error('Error fitting bounds:',bErr);
              }
            }
          }
        );
      } catch(srvErr){
        console.error('PlacesService error for', pharm.name, srvErr);
        completed +=1;
      }
    });
  }, [isLoaded, map, pharmacies, userLocation]);

  if (loadError) return <div>Error loading Google Maps</div>;
  if (!isLoaded) return <div>Loading map…</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      onLoad={onLoad}
      options={{ disableDefaultUI:true, zoomControl:true }}
    >
      {/* User location */}
      <Marker
        position={userLocation}
        icon={{
          url: USER_ICON_URL,
          scaledSize: new window.google.maps.Size(48,48)
        }}
      />

      {/* Controlled InfoWindow */}
      {selectedPharmacy && (
        <InfoWindow
          position={selectedPharmacy.position}
          onCloseClick={() => setSelectedPharmacy(null)}
        >
          <div style={{ fontFamily:'Arial, sans-serif', maxWidth:'240px' }}>
            <h3 style={{
              margin:'0 0 0.5rem',
              fontSize:'1.1rem',
              fontWeight:'bold'
            }}>{selectedPharmacy.pharmacy.name}</h3>
            <p style={{ margin:'0.25rem 0' }}>
              {selectedPharmacy.placeInfo.formatted_address}
            </p>
            <p style={{ margin:'0.25rem 0' }}>
                <strong>Drug:</strong>{' '}
                {(() => {
                    const raw = selectedPharmacy.pharmacy.matched_drugs[0] || '';
                    return raw.charAt(0).toUpperCase() + raw.slice(1);
                })()}
            </p>
            <p style={{ margin:'0.25rem 0' }}>
              <strong>Distance:</strong> {parseFloat(selectedPharmacy.pharmacy.distance_km).toFixed(2)} km
            </p>
            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${
                userLocation.lat},${userLocation.lng
              }&destination=${
                selectedPharmacy.position.lat()},${selectedPharmacy.position.lng()
              }`}
              target="_blank" rel="noopener noreferrer"
              style={{
                color:'#4285f4',
                textDecoration:'none',
                fontWeight:'bold'
              }}
            >Get Directions</a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
