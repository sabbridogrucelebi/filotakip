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

  if (timeDiff > 3600) return { color: '#000000', label: 'Bağlantı Kopuk', shadow: 'rgba(0,0,0,0.8)' };
  if (timeDiff > 600) return { color: '#64748b', label: 'Sinyal Yok', shadow: 'rgba(100,116,139,0.8)' };

  if (v.speed > 0) return { color: '#3b82f6', label: 'Hareket Halinde', shadow: 'rgba(59,130,246,0.8)' };
  
  if (v.speed === 0 && !v.ignition) return { color: '#ef4444', label: 'Duruyor', shadow: 'rgba(239,68,68,0.8)' };
  
  if (v.speed === 0 && v.ignition) {
    if (!v.idle_since) return { color: '#3b82f6', label: 'Hareket Halinde', shadow: 'rgba(59,130,246,0.8)' };
    const idleStart = new Date(v.idle_since);
    const idleTime = (now.getTime() - idleStart.getTime()) / 1000;
    
    if (idleTime > 60) return { color: '#a855f7', label: 'Kontak Açık Bekliyor', shadow: 'rgba(168,85,247,0.8)' };
    if (idleTime > 25) return { color: '#f97316', label: 'Rölantide', shadow: 'rgba(249,115,22,0.8)' };
    
    return { color: '#3b82f6', label: 'Hareket Halinde', shadow: 'rgba(59,130,246,0.8)' };
  }

  return { color: '#64748b', label: 'Sinyal Yok', shadow: 'rgba(100,116,139,0.8)' };
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
        <div class="mt-1 z-30 flex flex-col items-center whitespace-nowrap">
          <span class="font-extrabold text-[11px] tracking-wider" style="color: ${color === '#000000' ? '#334155' : color}; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0px 2px 4px rgba(0,0,0,0.5);">
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
              <Popup className="premium-vehicle-popup" maxWidth={280} minWidth={260}>
                <div className="bg-gradient-to-br from-[#0c1425] via-[#111c32] to-[#0a1628] rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl" style={{ margin: '-14px -20px -14px -20px' }}>
                  
                  {/* Header: Plate + Status Badge */}
                  <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: getVehicleStatusColor(v).color, boxShadow: `0 0 8px ${getVehicleStatusColor(v).shadow}` }}></div>
                        <span className="text-white font-black text-base tracking-[0.12em] drop-shadow-lg">{v.plate || v.imei}</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border" style={{ 
                        color: getVehicleStatusColor(v).color, 
                        borderColor: getVehicleStatusColor(v).color + '44',
                        backgroundColor: getVehicleStatusColor(v).color + '18'
                      }}>
                        {getVehicleStatusColor(v).label}
                      </span>
                    </div>
                    {v.vehicle_model && v.vehicle_model !== 'Unknown' && (
                      <p className="text-slate-500 text-[10px] mt-1 ml-[18px] tracking-wide">{v.vehicle_model}</p>
                    )}
                  </div>

                  {/* Driver Info */}
                  <div className="px-4 py-2.5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="text-slate-300 text-xs font-medium">
                        {v.driver_name || 'Şoför atanmadı'}
                      </span>
                    </div>
                    {v.driver_phone ? (
                      <a href={`tel:${v.driver_phone}`} className="flex items-center gap-2 group cursor-pointer mt-1 no-underline">
                        <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="text-emerald-400 text-xs font-mono group-hover:text-emerald-300 transition-colors">{v.driver_phone}</span>
                        <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-colors">ARA</span>
                      </a>
                    ) : (
                      <p className="text-slate-600 text-[10px] ml-[22px]">Telefon girilmedi</p>
                    )}
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-px bg-white/[0.04]">
                    <div className="bg-[#0f1a2e] px-3 py-2.5 text-center">
                      <p className="text-slate-500 text-[8px] uppercase tracking-widest font-bold mb-0.5">Hız</p>
                      <p className="text-white font-mono text-sm font-black">{v.speed}<span className="text-slate-500 text-[8px] ml-0.5">km/s</span></p>
                    </div>
                    <div className="bg-[#0f1a2e] px-3 py-2.5 text-center">
                      <p className="text-slate-500 text-[8px] uppercase tracking-widest font-bold mb-0.5">Yön</p>
                      <p className="text-white font-mono text-sm font-black">{v.course || 0}°</p>
                    </div>
                    <div className="bg-[#0f1a2e] px-3 py-2.5 text-center">
                      <p className="text-slate-500 text-[8px] uppercase tracking-widest font-bold mb-0.5">Sinyal</p>
                      <p className="text-slate-200 font-mono text-[10px] font-bold">{v.last_update ? new Date(v.last_update).toLocaleTimeString('tr-TR') : '-'}</p>
                    </div>
                  </div>

                  {/* Footer: Street View Button */}
                  <div className="px-4 py-2.5 border-t border-white/[0.06]">
                    <a 
                      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${v.lat},${v.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 rounded-lg py-1.5 transition-all cursor-pointer no-underline group"
                    >
                      <svg className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7zm0 2a2 2 0 110 4 2 2 0 010-4zm-1.5 5h3v1.5H14l-2 4.5-2-4.5h1.5V9z"/>
                      </svg>
                      <span className="text-amber-400 text-[10px] font-bold uppercase tracking-widest group-hover:text-amber-300 transition-colors">Sokak Görünümü</span>
                    </a>
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
