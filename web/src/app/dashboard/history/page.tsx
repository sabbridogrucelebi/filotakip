"use client";
import React, { useState, useEffect } from 'react';
import { Route, Search, Play, Pause, FastForward, Rewind, Truck, Calendar } from 'lucide-react';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });

const BACKEND = '/api/proxy';

export default function HistoryPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedImei, setSelectedImei] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x, 10x

  useEffect(() => {
    fetch(`${BACKEND}/vehicles`).then(r => r.json()).then(data => {
      setVehicles(Array.isArray(data) ? data : []);
      if (data.length > 0) setSelectedImei(data[0].imei);
    });
  }, []);

  const fetchHistory = async () => {
    if (!selectedImei || !date) return;
    setLoading(true);
    setError('');
    setHistory(null);
    setPlaybackIndex(0);
    setIsPlaying(false);

    try {
      const start = `${date} 00:00:00`;
      const end = `${date} 23:59:59`;
      const res = await fetch(`${BACKEND}/vehicles/${selectedImei}/history?start=${start}&end=${end}`);
      const data = await res.json();
      
      if (data.points && data.points.length > 0) {
        setHistory(data);
      } else {
        setError('Bu tarihte araca ait hareket verisi bulunamadı.');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  // Playback engine
  useEffect(() => {
    let interval: any;
    if (isPlaying && history?.points) {
      interval = setInterval(() => {
        setPlaybackIndex(prev => {
          if (prev >= history.points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, history]);

  // Leaflet Icons
  const [icons, setIcons] = useState<any>({});
  useEffect(() => {
    import('leaflet').then(L => {
      setIcons({
        car: new L.DivIcon({
          html: `<div style="font-size: 24px; filter: drop-shadow(0 0 10px rgba(59,130,246,0.8)); transform: rotate(-90deg);">🚙</div>`,
          className: 'bg-transparent',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }),
        stop: new L.DivIcon({
          html: `<div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(239,68,68,0.8);"></div>`,
          className: 'bg-transparent',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      });
    });
  }, []);

  const getSpeedColor = (speed: number) => {
    if (speed < 10) return '#3b82f6'; // Blue for slow
    if (speed < 60) return '#10b981'; // Green for normal
    if (speed < 90) return '#f59e0b'; // Yellow for fast
    return '#ef4444'; // Red for speeding
  };

  return (
    <div className="w-full h-full bg-[#02040a] flex flex-col lg:flex-row">
      
      {/* Control Panel (Left) */}
      <div className="w-full lg:w-80 shrink-0 bg-[#050b14] border-r border-slate-800/50 p-6 flex flex-col z-10 shadow-[20px_0_40px_rgba(0,0,0,0.5)]">
        
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Route className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Rota Geçmişi</h1>
            <p className="text-xs text-slate-400">Geçmiş seyahatleri izle</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Araç Seçimi</label>
            <select value={selectedImei} onChange={e => setSelectedImei(e.target.value)} className="w-full px-4 py-3 bg-black/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50">
              {vehicles.map(v => <option key={v.imei} value={v.imei}>{v.plate || v.imei} - {v.driver_name}</option>)}
            </select>
          </div>
          
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-2">Tarih</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-black/50 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500/50 [color-scheme:dark]" />
            </div>
          </div>

          <button 
            onClick={fetchHistory}
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : <><Search className="w-4 h-4" /> Rotayı Çiz</>}
          </button>
        </div>

        {error && <div className="text-red-400 text-sm font-medium bg-red-500/10 p-4 rounded-xl border border-red-500/20 mb-6">{error}</div>}

        {/* Stats Panel */}
        {history && (
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Günün Özeti</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400">Toplam Mesafe</p>
                  <p className="text-lg font-black text-blue-400">{history.stats.totalDistance} <span className="text-xs">km</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Maks. Hız</p>
                  <p className="text-lg font-black text-red-400">{history.stats.maxSpeed} <span className="text-xs">km/h</span></p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Durak Sayısı</p>
                  <p className="text-lg font-black text-white">{history.stats.totalStops}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Veri Noktası</p>
                  <p className="text-lg font-black text-white">{history.stats.totalPoints}</p>
                </div>
              </div>
            </div>

            {/* Stops List */}
            {history.stops.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Duraklamalar (&gt;2 dk)</h3>
                 <div className="space-y-3">
                   {history.stops.map((stop: any, idx: number) => (
                     <div key={idx} className="flex items-start gap-3 border-l-2 border-slate-700 pl-3">
                       <div>
                         <p className="text-sm font-bold text-white">{stop.durationMinutes} dakika</p>
                         <p className="text-xs text-slate-400 font-mono">{new Date(stop.startTime).toLocaleTimeString('tr-TR')} - {new Date(stop.endTime).toLocaleTimeString('tr-TR')}</p>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Area (Right) */}
      <div className="flex-1 relative bg-[#0a0f1c]">
        {history ? (
          <MapContainer 
            center={[history.points[0].lat, history.points[0].lng]} 
            zoom={13} 
            style={{ width: '100%', height: '100%', background: '#02040a' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap'
            />
            
            {/* Draw complete path */}
            <Polyline 
              positions={history.points.map((p: any) => [p.lat, p.lng])} 
              color="#3b82f6" 
              weight={4} 
              opacity={0.5} 
            />

            {/* Stops Markers */}
            {icons.stop && history.stops.map((stop: any, idx: number) => (
              <Marker key={idx} position={[stop.lat, stop.lng]} icon={icons.stop}>
                <Popup className="dark-popup">
                  <div className="p-2 text-center">
                    <p className="font-bold text-red-400 mb-1">Duraklama</p>
                    <p className="text-white font-mono text-sm">{stop.durationMinutes} Dakika</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Animated Vehicle Marker */}
            {icons.car && history.points[playbackIndex] && (
              <Marker 
                position={[history.points[playbackIndex].lat, history.points[playbackIndex].lng]} 
                icon={icons.car}
              >
                <Popup className="dark-popup">
                  <div className="p-2">
                    <p className="font-bold text-white text-lg">{history.points[playbackIndex].speed} km/h</p>
                    <p className="text-slate-400 text-xs font-mono">{new Date(history.points[playbackIndex].device_time).toLocaleString('tr-TR')}</p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <div className="text-center">
              <Route className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Geçmiş rotayı çizmek için sol panelden arama yapın.</p>
            </div>
          </div>
        )}

        {/* Playback Controls Overlay */}
        {history && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] bg-[#050b14]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4 w-[90%] max-w-2xl">
            
            <div className="w-full flex items-center gap-4">
              <span className="text-xs font-mono text-slate-400 shrink-0">{new Date(history.points[0].device_time).toLocaleTimeString('tr-TR')}</span>
              <input 
                type="range" 
                min="0" 
                max={history.points.length - 1} 
                value={playbackIndex} 
                onChange={(e) => setPlaybackIndex(parseInt(e.target.value))}
                className="w-full accent-purple-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-400 shrink-0">{new Date(history.points[history.points.length-1].device_time).toLocaleTimeString('tr-TR')}</span>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                {[1, 2, 5, 10, 20].map(speed => (
                  <button 
                    key={speed} 
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${playbackSpeed === speed ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]' : 'text-slate-400 hover:text-white'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>

              <div className="text-center min-w-[120px]">
                <p className="text-2xl font-black text-purple-400">{history.points[playbackIndex]?.speed || 0} <span className="text-sm font-bold text-slate-500">km/h</span></p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{history.points[playbackIndex] ? new Date(history.points[playbackIndex].device_time).toLocaleString('tr-TR') : ''}</p>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
