import React, { useState, useEffect, useCallback } from 'react';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow } from '@react-google-maps/api';

// building public urls for icons 
const USER_ICON_URL = process.env.PUBLIC_URL + '/images/user-icon.svg';
const PHARM_ICON_URL = process.env.PUBLIC_URL + '/images/pharm-icon.svg';

// container and default options
const containerStyle = { width: '100%', height: '100%' }; // Map container styles
const DEFAULT_ZOOM = 15; // zoom level
const libraries = ['places'];   // load Places library

export default function MapView({ userLocation, pharmacies }) {
  // load the maps and places script 
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });  

  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);          // { pharmacy_id, placeId, position }
  const [selected, setSelected] = useState(null);      // { place, markerPosition }

  // onLoad callback for GoogleMap
  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    // Center map on userLocation initially
    mapInstance.panTo(userLocation);
    mapInstance.setZoom(DEFAULT_ZOOM);
  }, [userLocation]);

  // build markers whenever `pharmacies` or `map` changes
  useEffect(() => {
    if (!map || pharmacies.length === 0) {
      setMarkers([]);
      return;
    }

    // take the 15 closest by distance_km
    const topList = [...pharmacies]
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 15);

    // use the PlacesService for text-to-place lookup
    const service = new window.google.maps.places.PlacesService(map);
    const newMarkers = [];

    topList.forEach((pharm, idx) => {
      const query = `${pharm.name} ${pharm.address}`;
      service.findPlaceFromQuery(
        { query, fields: ['place_id', 'geometry'] },
        (results, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            results &&
            results[0]
          ) {
            const place = results[0];
            newMarkers.push({
              pharmacy_id: pharm.pharmacy_id,
              placeId: place.place_id,
              position: place.geometry.location
            });
          } else {
            console.warn('Places lookup failed for', query, status);
          }

          // once we've processed all, update state & adjust viewport
          if (newMarkers.length + (topList.length - idx - 1) === topList.length) {
            setMarkers(newMarkers);
            // show user + first marker together
            const bounds = new window.google.maps.LatLngBounds();
            bounds.extend(userLocation);
            bounds.extend(newMarkers[0].position);
            map.fitBounds(bounds, 50);
          }
        }
      );
    });
  }, [map, pharmacies, userLocation]);
  
  // click handler: fetch minimal details and open InfoWindow
  const handleMarkerClick = (marker) => {
    const service = new window.google.maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId: marker.placeId,
        fields: ['name', 'formatted_address'] // restrict to just name + address
      },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setSelected({ place, position: marker.position });
        }
      }
    );
  };

  // render loading / error states while Maps JS is loading
  if (loadError) return <div>Error loading Google Maps</div>;
  if (!isLoaded) return <div>Loading map…</div>;
  
  return (
    <GoogleMap
    mapContainerStyle={containerStyle}
    onLoad={onLoad}
    options={{ disableDefaultUI: true, zoomControl: true }}
    >
    {/* 4) User location marker */}
    <Marker
        position={userLocation}
        icon={{
        url: USER_ICON_URL,
        scaledSize: new window.google.maps.Size(32, 32)
        }}
    />

    {/* 5) Pharmacy markers */}
    {markers.map((m) => (
        <Marker
        key={m.placeId}
        position={m.position}
        icon={{
            url: PHARM_ICON_URL,
            scaledSize: new window.google.maps.Size(32, 32)
        }}
        onClick={() => handleMarkerClick(m)}
        />
    ))}

    {/* 6) InfoWindow */}
    {selected && (
        <InfoWindow
        position={selected.position}
        onCloseClick={() => setSelected(null)}
        >
        <div style={{ maxWidth: '200px' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>{selected.place.name}</h4>
            <p style={{ margin: 0 }}>{selected.place.formatted_address}</p>
        </div>
        </InfoWindow>
    )}
    </GoogleMap>
  );
}
