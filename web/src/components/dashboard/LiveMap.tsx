import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ==================== MAP LAYER DEFINITIONS ====================
const MAP_LAYERS = {
  google_road: { name: 'Google Yol', provider: 'Google', icon: '🗺️', url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps' },
  google_satellite: { name: 'Google Uydu', provider: 'Google', icon: '🛰️', url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps' },
  google_hybrid: { name: 'Google Hibrit', provider: 'Google', icon: '🌍', url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps' },
  google_terrain: { name: 'Google Arazi', provider: 'Google', icon: '⛰️', url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', attribution: '&copy; Google Maps' },
  yandex_road: { name: 'Yandex Yol', provider: 'Yandex', icon: '🗺️', url: 'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&scale=1&lang=tr_TR', attribution: '&copy; Yandex Maps' },
  yandex_satellite: { name: 'Yandex Uydu', provider: 'Yandex', icon: '🛰️', url: 'https://core-sat.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}&scale=1&lang=tr_TR', attribution: '&copy; Yandex Maps' },
  yandex_hybrid: { name: 'Yandex Hibrit', provider: 'Yandex', icon: '🌍', url: 'https://core-renderer-tiles.maps.yandex.net/tiles?l=skl&x={x}&y={y}&z={z}&scale=1&lang=tr_TR', attribution: '&copy; Yandex Maps' },
} as const;
type MapLayerKey = keyof typeof MAP_LAYERS;

// Dynamic TileLayer switcher component
function DynamicTileLayer({ layerKey }: { layerKey: MapLayerKey }) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    const layer = MAP_LAYERS[layerKey];
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    const tileLayer = L.tileLayer(layer.url, { attribution: layer.attribution, maxZoom: 20 });
    tileLayer.addTo(map);
    layerRef.current = tileLayer;
    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [layerKey, map]);

  return null;
}

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
  const timeDiff = (now.getTime() - lastUpdate.getTime()) / 1000;

  if (timeDiff > 3600) return { color: '#1e1e1e', glow: '#555', label: 'BAĞLANTI KOPTU', sublabel: '1 saatten fazla sinyal yok', icon: '⚫' };
  if (timeDiff > 600) return { color: '#64748b', glow: '#94a3b8', label: 'SİNYAL YOK', sublabel: 'Uyku modunda', icon: '🔘' };

  if (v.speed > 0) return { color: '#3b82f6', glow: '#60a5fa', label: 'HAREKET HALİNDE', sublabel: `${v.speed} km/s hızla ilerliyor`, icon: '🔵' };
  
  if (v.speed === 0 && !v.ignition) return { color: '#ef4444', glow: '#f87171', label: 'KONTAK KAPALI', sublabel: 'Park halinde, motor kapalı', icon: '🔴' };
  
  if (v.speed === 0 && v.ignition) {
    if (!v.idle_since) return { color: '#f97316', glow: '#fb923c', label: 'KISA BEKLEME', sublabel: 'Kontak az önce açıldı', icon: '🟠' };
    const idleStart = new Date(v.idle_since);
    const idleTime = (now.getTime() - idleStart.getTime()) / 1000;
    
    if (idleTime >= 60) return { color: '#a855f7', glow: '#c084fc', label: 'RÖLANTİ', sublabel: `${Math.floor(idleTime/60)} dk ${Math.floor(idleTime%60)} sn kontak açık bekliyor`, icon: '🟣' };
    
    return { color: '#f97316', glow: '#fb923c', label: 'KISA BEKLEME', sublabel: `${Math.floor(idleTime)} sn kontak açık bekliyor`, icon: '🟠' };
  }

  return { color: '#64748b', glow: '#94a3b8', label: 'SİNYAL YOK', sublabel: 'Uyku modunda', icon: '🔘' };
};

// A custom PREMIUM ARVENTO-STYLE icon for vehicles
const createPremiumVehicleIcon = (v: any) => {
  const { color } = getVehicleStatusColor(v);
  const plate = v.plate || v.imei || 'Bilinmiyor';
  const isMoving = v.speed > 0;
  const course = v.course || 0;

  // When moving: navigation arrow (teardrop/pointer shape rotated to course direction)
  // When stopped: clean solid circle (like Arvento)
  const markerSvg = isMoving
    ? `<svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(${course}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
        <path d="M12 1 L20 20 L12 16 L4 20 Z" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      </svg>`
    : `<svg width="18" height="18" viewBox="0 0 18 18" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <circle cx="9" cy="9" r="7" fill="${color}" stroke="white" stroke-width="2.5"/>
      </svg>`;

  return new L.DivIcon({
    className: 'bg-transparent',
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; margin-top:${isMoving ? '-12px' : '-9px'};">
        ${markerSvg}
        <span style="
          margin-top: 2px;
          font-size: 10.5px;
          font-weight: 700;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          color: ${color === '#1e1e1e' ? '#475569' : color};
          white-space: nowrap;
          letter-spacing: 0.5px;
          text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0 1px 3px rgba(0,0,0,0.3);
        ">${plate}</span>
      </div>
    `,
    iconSize: [80, 40],
    iconAnchor: [40, isMoving ? 20 : 16]
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
      setHasZoomed(true);
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

// Click handler component inside MapContainer
function MarkerClickHandler({ onVehicleClick }: { onVehicleClick: (v: any) => void }) {
  // This component doesn't render anything, it's just a hook container
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
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [showStreetView, setShowStreetView] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayerKey>('google_road');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Keep selected vehicle data fresh
  useEffect(() => {
    if (selectedVehicle) {
      const updated = vehicles.find(v => v.imei === selectedVehicle.imei);
      if (updated) setSelectedVehicle(updated);
    }
  }, [vehicles]);

  const handleMarkerClick = useCallback((v: any) => {
    setSelectedVehicle(v);
    setShowStreetView(false);
  }, []);

  const closePanel = useCallback(() => {
    setSelectedVehicle(null);
    setShowStreetView(false);
  }, []);

  const status = selectedVehicle ? getVehicleStatusColor(selectedVehicle) : null;

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[39.0, 35.0]}
        zoom={6} 
        className="w-full h-full" 
        zoomControl={false}
      >
        <AutoZoom vehicles={vehicles} />
        <FocusController target={focusTarget || null} />
        
        {/* Dynamic Map Layer */}
        <DynamicTileLayer layerKey={mapLayer} />
        
        {vehicles.map(v => {
          if (!v.lat || !v.lng) return null;
          return (
            <Marker 
              key={v.id || v.imei} 
              position={[v.lat, v.lng]} 
              icon={createPremiumVehicleIcon(v)}
              eventHandlers={{
                click: () => handleMarkerClick(v)
              }}
            />
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

      {/* ==================== MAP LAYER SWITCHER ==================== */}
      <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000 }}>
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(145deg, rgba(8,12,28,0.95), rgba(2,6,18,0.98))',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(59,130,246,0.1)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            transition: 'all 0.2s',
            backdropFilter: 'blur(20px)',
          }}
          title="Harita Katmanı"
        >
          🗂️
        </button>

        {showLayerMenu && (
          <div style={{
            position: 'absolute',
            top: '50px',
            right: '0',
            width: '220px',
            background: 'linear-gradient(145deg, rgba(8,12,28,0.97), rgba(2,6,18,0.99))',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(59,130,246,0.08)',
            backdropFilter: 'blur(30px)',
            overflow: 'hidden',
            animation: 'slideIn 0.2s ease-out',
          }}>
            {/* Google Section */}
            <div style={{ padding: '12px 14px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#4285F4', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Google Haritalar</div>
              {(Object.entries(MAP_LAYERS) as [MapLayerKey, typeof MAP_LAYERS[MapLayerKey]][]).filter(([,v]) => v.provider === 'Google').map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => { setMapLayer(key); setShowLayerMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: '4px',
                    borderRadius: '10px',
                    border: mapLayer === key ? '1px solid rgba(66,133,244,0.5)' : '1px solid transparent',
                    background: mapLayer === key ? 'rgba(66,133,244,0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    color: mapLayer === key ? '#93bbfc' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: mapLayer === key ? 700 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{layer.icon}</span>
                  {layer.name}
                  {mapLayer === key && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#4285F4' }}>✓</span>}
                </button>
              ))}
            </div>
            {/* Yandex Section */}
            <div style={{ padding: '10px 14px 12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#FC3F1D', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Yandex Haritalar</div>
              {(Object.entries(MAP_LAYERS) as [MapLayerKey, typeof MAP_LAYERS[MapLayerKey]][]).filter(([,v]) => v.provider === 'Yandex').map(([key, layer]) => (
                <button
                  key={key}
                  onClick={() => { setMapLayer(key); setShowLayerMenu(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: '4px',
                    borderRadius: '10px',
                    border: mapLayer === key ? '1px solid rgba(252,63,29,0.5)' : '1px solid transparent',
                    background: mapLayer === key ? 'rgba(252,63,29,0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    color: mapLayer === key ? '#fca5a5' : '#94a3b8',
                    fontSize: '12px',
                    fontWeight: mapLayer === key ? 700 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{layer.icon}</span>
                  {layer.name}
                  {mapLayer === key && <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#FC3F1D' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================== PREMIUM VEHICLE INFO PANEL ==================== */}
      {selectedVehicle && status && (
        <div 
          style={{
            position: 'absolute',
            top: '80px',
            right: '20px',
            width: '340px',
            zIndex: 1000,
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {/* Main Card */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(8,12,28,0.97), rgba(2,6,18,0.99))',
            borderRadius: '20px',
            border: `1px solid ${status.color}33`,
            boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 40px ${status.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
            overflow: 'hidden',
            backdropFilter: 'blur(30px)',
          }}>
            
            {/* Top Glow Bar */}
            <div style={{
              height: '3px',
              background: `linear-gradient(90deg, transparent, ${status.color}, transparent)`,
              boxShadow: `0 0 20px ${status.color}80`,
            }}></div>

            {/* Header with Plate */}
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#fff',
                    letterSpacing: '3px',
                    textShadow: `0 0 30px ${status.color}40`,
                  }}>
                    {selectedVehicle.plate || selectedVehicle.imei}
                  </div>
                </div>
                {/* Close button */}
                <button 
                  onClick={closePanel}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '18px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#94a3b8'; }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Speed Gauge Display */}
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Speed Circle */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: `conic-gradient(${status.color} ${Math.min(selectedVehicle.speed / 180 * 360, 360)}deg, rgba(255,255,255,0.05) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 0 25px ${status.color}30, inset 0 0 20px rgba(0,0,0,0.5)`,
                position: 'relative',
                flexShrink: 0,
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'linear-gradient(145deg, #0a0f1e, #060a18)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)',
                }}>
                  <span style={{
                    fontSize: '20px',
                    fontWeight: 900,
                    color: status.color,
                    lineHeight: 1,
                    textShadow: `0 0 15px ${status.color}80`,
                  }}>
                    {selectedVehicle.speed}
                  </span>
                  <span style={{
                    fontSize: '8px',
                    color: '#64748b',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}>km/s</span>
                </div>
              </div>

              {/* Status Info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: `${status.color}15`,
                  border: `1px solid ${status.color}30`,
                  borderRadius: '10px',
                  padding: '8px 14px',
                  marginBottom: '8px',
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: status.color,
                    boxShadow: `0 0 10px ${status.color}`,
                    animation: 'pulse 2s infinite',
                  }}></div>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    color: status.color,
                    letterSpacing: '1px',
                  }}>
                    {status.label}
                  </span>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b',
                  lineHeight: 1.4,
                }}>
                  {status.sublabel}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
              margin: '0 20px',
            }}></div>

            {/* Driver Section */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#475569',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}>ŞOFÖR BİLGİSİ</div>
              
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #1e3a5f, #0f2540)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    border: '1px solid rgba(59,130,246,0.2)',
                    boxShadow: '0 0 15px rgba(59,130,246,0.1)',
                    flexShrink: 0,
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#e2e8f0',
                    }}>
                      {selectedVehicle.driver_name || 'Şoför Atanmadı'}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#475569',
                      letterSpacing: '1px',
                    }}>
                      {selectedVehicle.driver_phone || 'Telefon kayıtlı değil'}
                    </div>
                  </div>
                </div>

                {/* Call Button */}
                {selectedVehicle.driver_phone && (
                  <a 
                    href={`tel:${selectedVehicle.driver_phone}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #065f46, #064e3b)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: '#34d399',
                      fontWeight: 800,
                      fontSize: '13px',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      boxShadow: '0 0 20px rgba(16,185,129,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 30px rgba(16,185,129,0.3)'; e.currentTarget.style.background = 'linear-gradient(135deg, #047857, #065f46)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(16,185,129,0.15)'; e.currentTarget.style.background = 'linear-gradient(135deg, #065f46, #064e3b)'; }}
                  >
                    📞 {selectedVehicle.driver_phone} — ARA
                  </a>
                )}
              </div>
            </div>

            {/* Signal Info */}
            <div style={{ padding: '0 20px 16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.03)',
              }}>
                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>Son Sinyal</span>
                <span style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  background: 'rgba(0,0,0,0.4)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  {new Date(selectedVehicle.last_update).toLocaleTimeString('tr-TR')}
                </span>
              </div>
            </div>

            {/* Street View Button */}
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={() => setShowStreetView(!showStreetView)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '14px',
                  background: showStreetView
                    ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' 
                    : 'linear-gradient(135deg, #1e40af, #1d4ed8)',
                  border: showStreetView 
                    ? '1px solid rgba(167,139,250,0.3)' 
                    : '1px solid rgba(96,165,250,0.3)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13px',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  boxShadow: showStreetView 
                    ? '0 0 25px rgba(124,58,237,0.3)' 
                    : '0 0 25px rgba(59,130,246,0.2)',
                  transition: 'all 0.3s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                🗺️ {showStreetView ? 'Sokak Görünümünü Kapat' : 'Sokak Görünümünü Aç'}
              </button>
            </div>

            {/* Bottom Glow Bar */}
            <div style={{
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${status.color}40, transparent)`,
            }}></div>
          </div>

          {/* Street View Panel (Slides down below the card) */}
          {showStreetView && (
            <div style={{
              marginTop: '12px',
              borderRadius: '20px',
              overflow: 'hidden',
              border: '1px solid rgba(124,58,237,0.3)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 30px rgba(124,58,237,0.15)',
              animation: 'slideIn 0.3s ease-out',
            }}>
              {/* Street View Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1a1035, #0f0a2e)',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(124,58,237,0.2)',
              }}>
                <span style={{ color: '#c4b5fd', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                  🗺️ SOKAK GÖRÜNÜMÜ
                </span>
                <button 
                  onClick={() => setShowStreetView(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontSize: '14px',
                  }}
                >✕</button>
              </div>
              <iframe
                title="Street View"
                width="100%"
                height="250"
                frameBorder="0"
                style={{ border: 0, display: 'block', background: '#111' }}
                src={`https://maps.google.com/maps?layer=c&cbll=${selectedVehicle.lat},${selectedVehicle.lng}&cbp=11,0,0,0,0&output=svembed`}
                allowFullScreen
              ></iframe>
              {/* Fallback: open in new tab */}
              <div style={{
                background: 'linear-gradient(135deg, #0f0a2e, #1a1035)',
                padding: '10px 16px',
                borderTop: '1px solid rgba(124,58,237,0.15)',
                display: 'flex',
                justifyContent: 'center',
              }}>
                <a
                  href={`https://www.google.com/maps/@${selectedVehicle.lat},${selectedVehicle.lng},3a,75y,0h,90t/data=!3m4!1e1!3m2!1s!2e0`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#a78bfa',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: '0.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🔗 Yeni Sekmede Google Street View Aç
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .leaflet-popup-content-wrapper { 
          background: rgba(8,12,28,0.95) !important; 
          border-radius: 12px !important; 
          border: 1px solid rgba(255,255,255,0.1) !important;
          box-shadow: 0 15px 40px rgba(0,0,0,0.5) !important;
        }
        .leaflet-popup-content { margin: 8px 12px !important; }
        .leaflet-popup-tip { background: rgba(8,12,28,0.95) !important; }
      `}</style>
    </div>
  );
}
