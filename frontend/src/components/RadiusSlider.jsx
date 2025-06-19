import React from 'react';
import './RadiusSlider.css'

/**
 * RadiusSlider component
 * Props:
 *  - value: current radius (km)
 *  - onChange: callback when slider changes
 */
export default function RadiusSlider({ radius, onChange, min=1, max=50 }) {
  return (
    <div className="radius-slider">
      <label htmlFor="radius-range">Radius: {radius} km</label>
      <input
        id="radius-range"
        type="range"
        min={min}
        max={max}
        value={radius}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
