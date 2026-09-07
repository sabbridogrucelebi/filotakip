"use client";
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const glowingIcon = new L.DivIcon({
  className: 'bg-transparent',
  html: `
    <div class="relative flex items-center justify-center w-6 h-6">
      <div class="absolute inset-0 rounded-full animate-ping opacity-75 bg-blue-500"></div>
      <div class="relative w-3 h-3 rounded-full border border-white z-10 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

export default function MiniMap({ lat, lng, imei }: { lat: number; lng: number; imei: string }) {
  return (
    <div className="w-full h-48 rounded-xl overflow-hidden border border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] z-0 relative">
      <MapContainer 
        center={[lat, lng]} 
        zoom={14} 
        className="w-full h-full" 
        zoomControl={false}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
        />
        <Marker position={[lat, lng]} icon={glowingIcon}>
          <Popup className="premium-popup">
            <div className="font-bold text-white">IMEI: {imei}</div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
