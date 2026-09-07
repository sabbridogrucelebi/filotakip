import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Helper to determine the color of the vehicle marker based on user's specific rules
const getVehicleStatusColor = (v: any) => {
  const now = new Date();
  const lastUpdate = new Date(v.last_update);
  const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000; // in seconds

  if (timeDiff > 3600) return { color: '#000000', label: 'Siyah', shadow: 'rgba(0,0,0,0.8)' }; // Black (Offline > 1hr)
  if (timeDiff > 600) return { color: '#64748b', label: 'Gri', shadow: 'rgba(100,116,139,0.8)' }; // Grey (No signal > 10m)

  if (v.speed > 0) return { color: '#3b82f6', label: 'Mavi', shadow: 'rgba(59,130,246,0.8)' }; // Blue (Moving)
  
  if (v.speed === 0 && !v.ignition) return { color: '#ef4444', label: 'Kırmızı', shadow: 'rgba(239,68,68,0.8)' }; // Red (Stopped, Engine OFF)
  
  if (v.speed === 0 && v.ignition) {
    if (!v.idle_since) return { color: '#3b82f6', label: 'Mavi', shadow: 'rgba(59,130,246,0.8)' }; // Assume blue if just stopped
    const idleStart = new Date(v.idle_since);
    const idleTime = (now.getTime() - idleStart.getTime()) / 1000;
    
    if (idleTime > 60) return { color: '#a855f7', label: 'Mor', shadow: 'rgba(168,85,247,0.8)' }; // Purple (Idle > 60s)
    if (idleTime > 25) return { color: '#f97316', label: 'Turuncu', shadow: 'rgba(249,115,22,0.8)' }; // Orange (Idle > 25s)
    
    return { color: '#3b82f6', label: 'Mavi', shadow: 'rgba(59,130,246,0.8)' }; // Still blue if idle < 25s
  }

  return { color: '#64748b', label: 'Gri', shadow: 'rgba(100,116,139,0.8)' };
};

// A custom PREMIUM ARVENTO-STYLE icon for vehicles
const createPremiumVehicleIcon = (v: any) => {
  const { color, shadow } = getVehicleStatusColor(v);
  const plate = v.plate || v.imei || 'Bilinmiyor';

  return new L.DivIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative flex flex-col items-center justify-center -mt-6">
        <!-- The Circular Marker -->
        <div class="relative flex items-center justify-center w-6 h-6 z-20">
          <div class="absolute inset-0 rounded-full animate-pulse opacity-40" style="background-color: ${color}; box-shadow: 0 0 20px ${shadow};"></div>
          <div class="relative w-4 h-4 rounded-full border-[3px] border-white z-10 shadow-lg" style="background-color: ${color}; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"></div>
        </div>
        <!-- Permanent Plate Label Below Marker -->
        <div class="mt-1 bg-[#111827]/90 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-30 flex flex-col items-center whitespace-nowrap">
          <span class="text-white font-bold text-[10px] tracking-wider" style="color: ${color === '#000000' ? '#e2e8f0' : color}; text-shadow: 0 0 5px ${shadow};">
            ${plate}
          </span>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

// A custom RED neon icon for searched addresses
const createAddressIcon = () => {
  return new L.DivIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative flex flex-col items-center justify-center w-8 h-12 -mt-4">
        <div class="absolute inset-0 rounded-full animate-ping opacity-50 bg-rose-500"></div>
        <div class="relative w-5 h-5 rounded-full border-2 border-white bg-rose-500 z-10 shadow-[0_0_20px_rgba(244,63,94,0.8),0_0_40px_rgba(244,63,94,0.6)]"></div>
        <div class="w-1 h-4 bg-gradient-to-b from-rose-500 to-transparent"></div>
      </div>
    `,
    iconSize: [32, 48],
    iconAnchor: [16, 48]
  });
};

// Component to handle automatic flying to the densest cluster
function AutoZoom({ vehicles }: { vehicles: any[] }) {
  const map = useMap();
  const [hasZoomed, setHasZoomed] = useState(false);

  useEffect(() => {
    if (hasZoomed || !vehicles || vehicles.length === 0) return;

    const clusters: Record<string, typeof vehicles> = {};
    
    vehicles.forEach(v => {
      if(!v.lat || !v.lng) return;
      const key = `${Math.round(v.lat)}-${Math.round(v.lng)}`;
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(v);
    });

    let maxCluster: typeof vehicles = [];
    Object.values(clusters).forEach(cluster => {
      if (cluster.length > maxCluster.length) {
        maxCluster = cluster;
      }
    });

    if (maxCluster.length === 0) return;

    const centerLat = maxCluster.reduce((sum, v) => sum + v.lat, 0) / maxCluster.length;
    const centerLng = maxCluster.reduce((sum, v) => sum + v.lng, 0) / maxCluster.length;

    const timer = setTimeout(() => {
      map.flyTo([centerLat, centerLng], 11, {
        duration: 3, 
        easeLinearity: 0.25
      });
      setHasZoomed(true); // Ensure it only happens once on initial load
    }, 1000);

    return () => clearTimeout(timer);
  }, [map, vehicles, hasZoomed]);

  return null;
}

function FocusController({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.5 });
    }
  }, [target, map]);
  return null;
}

export default function LiveMap({ 
  vehicles = [], 
  focusTarget,
  searchMarker
}: { 
  vehicles: any[], 
  focusTarget?: { lat: number; lng: number; zoom: number } | null,
  searchMarker?: { lat: number; lng: number; title: string } | null
}) {
  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[39.0, 35.0]} // Initial Turkey Wide View
        zoom={6} 
        className="w-full h-full" 
        zoomControl={false}
      >
        <AutoZoom vehicles={vehicles} />
        <FocusController target={focusTarget || null} />
        
        {/* Google Maps (Light Theme Roadmap) */}
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution='&copy; Google Maps'
        />
        
        {vehicles.map(v => {
          if (!v.lat || !v.lng) return null;
          return (
            <Marker key={v.id || v.imei} position={[v.lat, v.lng]} icon={createPremiumVehicleIcon(v)}>
              <Popup className="premium-popup !p-0 overflow-hidden rounded-xl border border-white/10 bg-[#0f172a]/95 backdrop-blur-xl">
                <div className="p-3 w-48">
                  <div className="font-bold text-white tracking-widest text-sm border-b border-white/10 pb-2 mb-2">{v.plate || v.imei}</div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400">Hız:</span>
                    <span className="text-white font-mono">{v.speed} km/s</span>
                  </div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="text-slate-400">Durum:</span>
                    <span className="font-bold uppercase" style={{ color: getVehicleStatusColor(v).color }}>
                      {getVehicleStatusColor(v).label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Son Sinyal:</span>
                    <span className="text-slate-200 font-mono text-[10px]">{new Date(v.last_update).toLocaleTimeString('tr-TR')}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Address Search Marker */}
        {searchMarker && (
          <Marker position={[searchMarker.lat, searchMarker.lng]} icon={createAddressIcon()}>
            <Popup className="premium-popup border-rose-500/50">
              <div className="font-bold text-white tracking-wide text-xs">{searchMarker.title}</div>
              <div className="text-[10px] text-rose-400 mt-1 uppercase font-bold tracking-widest">Arama Sonucu</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
