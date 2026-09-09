"use client";
import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, CheckCircle, Navigation, Search } from 'lucide-react';
import { io } from 'socket.io-client';

// Dynamically import Leaflet Map to avoid SSR window is not defined error
const LiveMap = dynamic(() => import('@/components/dashboard/LiveMap'), { ssr: false });

import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DashboardPage() {
  const [showCards, setShowCards] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState("%0.0");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; title: string } | null>(null);

  // Determine the dominant city center from vehicle positions for search biasing
  const dominantCityCenter = useMemo(() => {
    if (vehicles.length === 0) return null;
    const lats = vehicles.map(v => v.lat).filter(Boolean);
    const lngs = vehicles.map(v => v.lng).filter(Boolean);
    if (lats.length === 0) return null;
    return {
      lat: lats.reduce((a: number, b: number) => a + b, 0) / lats.length,
      lng: lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length,
    };
  }, [vehicles]);

  // Debounced Search Logic for Suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      const query = searchQuery.toLowerCase().trim();
      let newSuggestions: any[] = [];

      // 1. Check if it matches any vehicle
      const matchingVehicles = vehicles.filter(v => 
        (v.plate && v.plate.toLowerCase().includes(query)) || 
        (v.imei && v.imei.toLowerCase().includes(query))
      ).map(v => ({ type: 'vehicle', title: v.plate || v.imei, lat: v.lat, lng: v.lng, data: v }));
      
      newSuggestions = [...matchingVehicles];

      // 2. Build viewbox from vehicle cluster center (tighter bias around dominant city)
      let viewboxParam = '';
      if (dominantCityCenter) {
        const radius = 0.3; // ~30km radius
        const minLat = dominantCityCenter.lat - radius;
        const maxLat = dominantCityCenter.lat + radius;
        const minLng = dominantCityCenter.lng - radius;
        const maxLng = dominantCityCenter.lng + radius;
        viewboxParam = `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1`;
      }

      // 3. Fetch Nominatim with tighter city bias first
      try {
        // First try: bounded search (only results within vehicle cluster area)
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=tr${viewboxParam}`);
        const data = await res.json();
        
        let addressSuggestions = data.map((item: any) => ({
          type: 'address',
          title: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));

        // If bounded search returns too few results, do a wider Turkey-wide search
        if (addressSuggestions.length < 2 && dominantCityCenter) {
          const widerRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=tr`);
          const widerData = await widerRes.json();
          const widerSuggestions = widerData.map((item: any) => ({
            type: 'address',
            title: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon)
          }));
          // Merge without duplicates
          const existingTitles = new Set(addressSuggestions.map((s: any) => s.title));
          widerSuggestions.forEach((s: any) => {
            if (!existingTitles.has(s.title)) addressSuggestions.push(s);
          });
        }
        
        newSuggestions = [...newSuggestions, ...addressSuggestions].slice(0, 7);
      } catch (err) {
        console.error("Geocoding failed:", err);
      }

      setSuggestions(newSuggestions);
      setShowSuggestions(true);
      setIsSearching(false);
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, vehicles, dominantCityCenter]);

  const handleSelectSuggestion = (suggestion: any) => {
    // Clear search after selecting
    setSearchQuery("");
    setShowSuggestions(false);
    setSuggestions([]);
    setFocusTarget({ lat: suggestion.lat, lng: suggestion.lng, zoom: suggestion.type === 'vehicle' ? 16 : 14 });
    
    if (suggestion.type === 'address') {
      setSearchMarker({ lat: suggestion.lat, lng: suggestion.lng, title: suggestion.title });
    } else {
      setSearchMarker(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
    }
  };

  // Setup WebSockets and Initial Fetch
  useEffect(() => {
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        setServerStatus("%99.9");
      })
      .catch(err => {
        console.error("Failed to fetch initial vehicles:", err);
        setServerStatus("%0.0");
      });

    const backendUrl = typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://127.0.0.1:3001';
    const socket = io(backendUrl);

    socket.on('connect', () => console.log('Socket connected!'));
    socket.on('connect_error', (err) => console.error('Socket connection error:', err.message));

    socket.on('location_update', (newLocation) => {
      setVehicles(prevVehicles => {
        const index = prevVehicles.findIndex(v => v.imei === newLocation.imei);
        if (index > -1) {
          const updated = [...prevVehicles];
          const newV = { ...updated[index], ...newLocation };
          if (newV.speed > 0 || !newV.ignition) {
            newV.idle_since = null;
          } else if (newV.speed === 0 && newV.ignition && !newV.idle_since) {
            newV.idle_since = new Date().toISOString();
          }
          updated[index] = newV;
          return updated;
        } else {
          return [...prevVehicles, newLocation];
        }
      });
    });

    socket.on('device_status', (statusUpdate) => {
      setVehicles(prevVehicles => {
        const index = prevVehicles.findIndex(v => v.imei === statusUpdate.imei);
        if (index > -1) {
          const updated = [...prevVehicles];
          const newV = { ...updated[index], ignition: statusUpdate.acc_on };
          if (newV.speed > 0 || !newV.ignition) {
            newV.idle_since = null;
          } else if (newV.speed === 0 && newV.ignition && !newV.idle_since) {
            newV.idle_since = new Date().toISOString();
          }
          updated[index] = newV;
          return updated;
        }
        return prevVehicles;
      });
    });

    const interval = setInterval(() => {
      setVehicles((v: any[]) => [...v]);
    }, 5000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  // Calculate KPIs
  const totalVehicles = vehicles.length;
  const movingVehicles = vehicles.filter(v => v.speed > 0).length;
  const speedingAlarms = vehicles.filter(v => v.speed > 100).length;

  // KPI data for bottom cards
  const kpiItems = [
    { title: 'TOPLAM ARAÇ', value: totalVehicles, icon: '🚗', accent: '#3b82f6' },
    { title: 'HAREKET HALİNDE', value: movingVehicles, icon: '🚀', accent: '#10b981' },
    { title: 'HIZ İHLALİ / ALARM', value: speedingAlarms, icon: '⚠️', accent: '#ef4444' },
    { title: 'SİSTEM SAĞLIĞI', value: serverStatus, icon: '🛡️', accent: '#8b5cf6' },
  ];

  return (
    <div className="w-full h-full relative bg-[#02040a] overflow-hidden">
      {/* Background Map */}
      <div className="absolute inset-0 z-0">
        <LiveMap vehicles={vehicles} focusTarget={focusTarget} searchMarker={searchMarker} />
      </div>

      {/* ==================== PREMIUM SEARCH BAR ==================== */}
      <div className="absolute top-6 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="w-full max-w-2xl relative pointer-events-auto">
          <form 
            onSubmit={handleSearchSubmit} 
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '16px',
              padding: '6px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              zIndex: 30,
              transition: 'all 0.3s',
            }}
          >
            <div style={{ paddingLeft: '14px' }}>
              {isSearching ? (
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid #3b82f6', borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite',
                }}></div>
              ) : (
                <Search style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
              )}
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Araç Plakası, IMEI veya Adres Ara (Örn: Konya, Selçuklu)" 
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: '#1e293b',
                fontSize: '14px',
                fontWeight: 500,
                padding: '10px 6px',
                outline: 'none',
                letterSpacing: '0.3px',
              }}
            />
            <button 
              type="submit" 
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                color: '#fff',
                padding: '10px 24px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase' as const,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
              }}
            >
              Ara
            </button>
          </form>

          {/* Autocomplete Dropdown - Premium White */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '8px',
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)',
              zIndex: 20,
            }}>
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    textAlign: 'left',
                    padding: '12px 16px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    gap: '12px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: item.type === 'vehicle' 
                      ? 'linear-gradient(135deg, #dbeafe, #bfdbfe)' 
                      : 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
                    border: item.type === 'vehicle' 
                      ? '1px solid rgba(59,130,246,0.2)' 
                      : '1px solid rgba(16,185,129,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}>
                    {item.type === 'vehicle' ? '🚗' : '📍'}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                    <p style={{ 
                      fontSize: '13px', fontWeight: 600, color: '#1e293b',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      margin: 0,
                    }}>{item.title}</p>
                    <p style={{ 
                      fontSize: '10px', color: '#94a3b8', fontWeight: 600,
                      letterSpacing: '1.5px', textTransform: 'uppercase',
                      marginTop: '2px', margin: 0,
                    }}>
                      {item.type === 'vehicle' ? 'Araç Filosu' : 'Harita Sonucu'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== BOTTOM KPI CARDS - PREMIUM WHITE ==================== */}
      <div className={`absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center transition-all duration-500 ease-in-out ${showCards ? 'translate-y-0' : 'translate-y-[120px]'}`}>
        
        {/* Drawer Toggle Handle */}
        <button 
          onClick={() => setShowCards(!showCards)}
          style={{
            marginBottom: '8px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.06)',
            borderBottom: 'none',
            borderRadius: '12px 12px 0 0',
            padding: '6px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
            cursor: 'pointer',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
            transition: 'all 0.2s',
            gap: '6px',
          }}
          title={showCards ? "İstatistikleri Gizle" : "İstatistikleri Göster"}
        >
          {showCards ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronUp style={{ width: '14px', height: '14px' }} />}
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{showCards ? "Gizle" : "Göster"}</span>
        </button>

        {/* The Cards */}
        <div className="w-full px-8 pointer-events-none">
          <div style={{ display: 'flex', gap: '14px', maxWidth: '1200px', margin: '0 auto' }} className="pointer-events-auto">
            {kpiItems.map((kpi, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.92)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
                  position: 'relative' as const,
                  overflow: 'hidden',
                  cursor: 'default',
                  transition: 'all 0.3s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={e => { 
                  e.currentTarget.style.transform = 'translateY(-3px)'; 
                  e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.12), 0 0 20px ${kpi.accent}15`;
                }}
                onMouseLeave={e => { 
                  e.currentTarget.style.transform = 'translateY(0)'; 
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)';
                }}
              >
                {/* Left accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '3px',
                  height: '100%',
                  background: `linear-gradient(180deg, ${kpi.accent}, ${kpi.accent}60)`,
                  borderRadius: '0 2px 2px 0',
                }}></div>

                <div style={{ paddingLeft: '6px' }}>
                  <p style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#94a3b8',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    marginBottom: '4px',
                    margin: 0,
                  }}>{kpi.title}</p>
                  <h3 style={{
                    fontSize: '22px',
                    fontWeight: 900,
                    color: '#0f172a',
                    margin: '4px 0 0 0',
                    letterSpacing: '-0.5px',
                  }}>{kpi.value}</h3>
                </div>

                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${kpi.accent}15, ${kpi.accent}08)`,
                  border: `1px solid ${kpi.accent}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}>
                  {kpi.icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
