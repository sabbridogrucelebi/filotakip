"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Next.js SSR'da patlamaması için react-globe.gl'yi sadece client tarafında yüklüyoruz
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function EarthScene() {
  const globeRef = useRef<any>(null);
  const [countries, setCountries] = useState({ features: [] });
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  
  // Real Logistic Hubs
  const hubs = [
    { name: 'Istanbul', lat: 41.0082, lng: 28.9784, size: 1.5, color: '#ef4444' }, // Red
    { name: 'London', lat: 51.5074, lng: -0.1278, size: 1, color: '#3b82f6' },    // Blue
    { name: 'New York', lat: 40.7128, lng: -74.0060, size: 1, color: '#a855f7' }, // Purple
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, size: 1.2, color: '#10b981' },  // Green
    { name: 'Dubai', lat: 25.2048, lng: 55.2708, size: 1, color: '#f59e0b' },     // Yellow
    { name: 'Frankfurt', lat: 50.1109, lng: 8.6821, size: 0.8, color: '#06b6d4' } // Cyan
  ];

  // Random vehicles across the globe
  const [vehicles, setVehicles] = useState<any[]>([]);

  // Routes connecting the hubs
  const routes = [
    { startLat: 41.0082, startLng: 28.9784, endLat: 50.1109, endLng: 8.6821, color: ['#ef4444', '#06b6d4'] }, // Istanbul -> Frankfurt
    { startLat: 51.5074, startLng: -0.1278, endLat: 40.7128, endLng: -74.0060, color: ['#3b82f6', '#a855f7'] }, // London -> NY
    { startLat: 25.2048, startLng: 55.2708, endLat: 35.6762, endLng: 139.6503, color: ['#f59e0b', '#10b981'] }, // Dubai -> Tokyo
    { startLat: 41.0082, startLng: 28.9784, endLat: 25.2048, endLng: 55.2708, color: ['#ef4444', '#f59e0b'] }  // Istanbul -> Dubai
  ];

  useEffect(() => {
    // Make globe responsive to window size
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    // Load GeoJSON data for country borders
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(data => setCountries(data));

    // Generate random vehicles clustered around Turkey and Europe
    const randomVehicles = Array.from({ length: 40 }).map(() => ({
      lat: 30 + Math.random() * 25,
      lng: 10 + Math.random() * 40,
      size: 0.6,
      color: '#38bdf8' // Neon Cyan
    }));
    
    // Extra vehicles specifically in Turkey
    const turkeyVehicles = Array.from({ length: 15 }).map(() => ({
      lat: 37.0 + Math.random() * 4.0,
      lng: 27.0 + Math.random() * 16.0,
      size: 0.8,
      color: '#ef4444' // Neon Red
    }));

    setVehicles([...hubs, ...randomVehicles, ...turkeyVehicles]);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (globeRef.current) {
      // Auto-rotate setup (Very slow)
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.controls().enableZoom = false;
      
      // Position camera back so we see Europe and Turkey clearly without clipping
      // Centered so it fills the screen perfectly
      globeRef.current.pointOfView({ lat: 39.0, lng: 35.0, altitude: 1.5 }, 2000);
    }
  }, [globeRef.current, dimensions.width]);

  return (
    <div className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0 overflow-hidden flex items-center justify-center">
      <div className="w-full h-full flex items-center justify-center transition-transform duration-1000" style={{ transform: 'translateX(-10%)' }}>
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          
          // Deep Space Stars Background
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          
          // Planet appearance
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          
          // Map Borders (Neon Lines)
          polygonsData={countries.features}
          polygonAltitude={0.002}
          polygonCapColor={() => 'rgba(2, 4, 10, 0.6)'} // Dark fill
          polygonSideColor={() => 'rgba(0, 0, 0, 0)'} // No side
          polygonStrokeColor={() => '#3b82f6'} // NEON BLUE BORDER
          
          // SLEEK 2D DOTS (Instead of ugly 3D cylinders)
          labelsData={vehicles}
          labelLat="lat"
          labelLng="lng"
          labelDotRadius={(d: any) => d.size * 0.4}
          labelDotOrientation={() => 'right'}
          labelColor={(d: any) => d.color}
          labelText={() => ''}
          labelResolution={2}

          // Pulsing Neon Radar Rings for Vehicles
          ringsData={vehicles}
          ringColor={(d: any) => d.color}
          ringMaxRadius={(d: any) => d.size * 1.5}
          ringPropagationSpeed={1.5}
          ringRepeatPeriod={(d: any) => 800 + Math.random() * 500}
          
          // Flying Routes (Ultra thin and elegant)
          arcsData={routes}
          arcStartLat="startLat"
          arcStartLng="startLng"
          arcEndLat="endLat"
          arcEndLng="endLng"
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={0.2}
          arcDashAnimateTime={2000}
          arcAltitudeAutoScale={0.2}
          arcStroke={0.3} // VERY THIN STROKE
        />
      </div>
      
      {/* CSS based deep space gradient (overlayed under the stars) */}
      <div className="absolute inset-0 z-[-1] bg-[#02040a]" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #0f172a 0%, #02040a 60%)' }}></div>
    </div>
  );
}
