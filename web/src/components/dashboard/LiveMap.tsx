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

// A custom CYBERPUNK neon icon for vehicles with pulsing radar effect
const createNeonIcon = (speed: number) => {
  // Color logic based on status
  let color = '#3b82f6'; // moving (blue)
  let shadowColor = 'rgba(59,130,246,0.8)';
  
  if (speed === 0) {
    color = '#f59e0b'; // stopped (orange)
    shadowColor = 'rgba(245,158,11,0.8)';
  }
  if (speed > 100) {
    color = '#ef4444'; // speeding (red)
    shadowColor = 'rgba(239,68,68,0.8)';
  }

  return new L.DivIcon({
    className: 'bg-transparent',
    html: `
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="absolute inset-0 rounded-full animate-ping opacity-75" style="background-color: ${color};"></div>
        <div class="relative w-3 h-3 rounded-full border border-white z-10" style="background-color: ${color}; box-shadow: 0 0 15px ${shadowColor}, 0 0 30px ${shadowColor};"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
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
            <Marker key={v.id || v.imei} position={[v.lat, v.lng]} icon={createNeonIcon(v.speed)}>
              <Popup className="premium-popup">
                <div className="font-bold text-white tracking-widest">{v.plate || v.imei}</div>
                <div className="text-sm text-slate-400 mt-1">Hız: <span className="text-white font-mono">{v.speed} km/s</span></div>
                <div className="text-xs mt-2 uppercase font-bold" style={{ color: v.speed > 0 ? '#3b82f6' : '#f59e0b' }}>
                  {v.status === 'moving' || v.speed > 0 ? 'Hareket Halinde' : 'Rölanti / Duruyor'}
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
