"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, CheckCircle, Navigation, Search } from 'lucide-react';
import { io } from 'socket.io-client';

// Dynamically import Leaflet Map to avoid SSR window is not defined error
const LiveMap = dynamic(() => import('@/components/dashboard/LiveMap'), { ssr: false });

function KPICard({ title, value, icon: Icon, color }: any) {
  const colorStyles = {
    blue: 'text-cyan-400 bg-[#050B14]/80 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]',
    emerald: 'text-emerald-400 bg-[#050B14]/80 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]',
    red: 'text-rose-400 bg-[#050B14]/80 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)] hover:shadow-[0_0_25px_rgba(244,63,94,0.3)]',
    purple: 'text-indigo-400 bg-[#050B14]/80 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)]',
  };
  
  return (
    <div className={`flex-1 backdrop-blur-2xl border rounded-xl p-3 px-5 transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden group flex items-center justify-between ${colorStyles[color as keyof typeof colorStyles]}`}>
      <div className={`absolute top-0 left-0 h-full w-[2px] bg-current opacity-50 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_currentColor]`}></div>
      <div>
        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.15em] mb-1">{title}</p>
        <h3 className="text-xl font-black text-white tracking-tight drop-shadow-lg relative z-10">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg bg-[#050B14] border border-current shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]`}>
        <Icon className="w-4 h-4 opacity-80 group-hover:opacity-100 transition-opacity drop-shadow-[0_0_5px_currentColor]" />
      </div>
    </div>
  );
}

import { ChevronUp, ChevronDown } from 'lucide-react';

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [searchMarker, setSearchMarker] = useState<{ lat: number; lng: number; title: string } | null>(null);

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

      // 2. Calculate Bounding Box (Viewbox) of all vehicles for location biasing
      let viewboxParam = '';
      if (vehicles.length > 0) {
        const lats = vehicles.map(v => v.lat).filter(Boolean);
        const lngs = vehicles.map(v => v.lng).filter(Boolean);
        if (lats.length > 0 && lngs.length > 0) {
          const minLat = Math.min(...lats) - 0.5; // add some padding
          const maxLat = Math.max(...lats) + 0.5;
          const minLng = Math.min(...lngs) - 0.5;
          const maxLng = Math.max(...lngs) + 0.5;
          // Nominatim viewbox format: <left>,<top>,<right>,<bottom> -> minLng,maxLat,maxLng,minLat
          viewboxParam = `&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=0`;
        }
      }

      // 3. Fetch Nominatim Geocoding API with Context-Aware Viewbox
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5${viewboxParam}`);
        const data = await res.json();
        
        const addressSuggestions = data.map((item: any) => ({
          type: 'address',
          title: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
        
        newSuggestions = [...newSuggestions, ...addressSuggestions].slice(0, 7); // Max 7 items
      } catch (err) {
        console.error("Geocoding failed:", err);
      }

      setSuggestions(newSuggestions);
      setShowSuggestions(true);
      setIsSearching(false);
    }, 600); // 600ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, vehicles]);

  const handleSelectSuggestion = (suggestion: any) => {
    setSearchQuery(suggestion.title);
    setShowSuggestions(false);
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
      handleSelectSuggestion(suggestions[0]); // Select best match
    }
  };

  // Setup WebSockets and Initial Fetch
  useEffect(() => {
    // 1. Fetch initial positions from REST API
    fetch('/api/vehicles')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        setServerStatus("%99.9"); // If it succeeded, we're online
      })
      .catch(err => {
        console.error("Failed to fetch initial vehicles:", err);
        setServerStatus("%0.0");
      });

    // 2. Connect to Socket.IO for Live Updates
    const socket = io();

    socket.on('connect', () => console.log('Socket connected!'));

    socket.on('location_update', (newLocation) => {
      setVehicles(prevVehicles => {
        const index = prevVehicles.findIndex(v => v.imei === newLocation.imei);
        if (index > -1) {
          // Update existing vehicle
          const updated = [...prevVehicles];
          updated[index] = { ...updated[index], ...newLocation };
          return updated;
        } else {
          // Add new vehicle if not in list
          return [...prevVehicles, newLocation];
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Calculate KPIs
  const totalVehicles = vehicles.length;
  const movingVehicles = vehicles.filter(v => v.speed > 0).length;
  // Let's assume speed > 100 is an alarm/speeding violation
  const speedingAlarms = vehicles.filter(v => v.speed > 100).length;

  return (
    <div className="w-full h-full relative bg-[#02040a] overflow-hidden">
      {/* Background Map */}
      <div className="absolute inset-0 z-0">
        <LiveMap vehicles={vehicles} focusTarget={focusTarget} searchMarker={searchMarker} />
      </div>

      {/* Top Search Bar with Autocomplete */}
      <div className="absolute top-6 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="w-full max-w-2xl relative pointer-events-auto">
          <form onSubmit={handleSearchSubmit} className="w-full bg-[#050B14]/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center gap-2 group focus-within:border-cyan-500/70 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all z-30 relative">
            <div className="pl-4">
              {isSearching ? (
                <div className="w-5 h-5 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin"></div>
              ) : (
                <Search className="w-5 h-5 text-cyan-500 group-focus-within:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-colors" />
              )}
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} // delay to allow click
              placeholder="Araç Plakası, IMEI veya Adres Ara (Örn: Konya, Selçuklu)" 
              className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:outline-none py-2 px-2 font-mono text-sm tracking-wide"
            />
            <button 
              type="submit" 
              className="bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]"
            >
              Ara
            </button>
          </form>

          {/* Autocomplete Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#050B14]/95 backdrop-blur-2xl border border-cyan-500/30 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-20 flex flex-col">
              {suggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSuggestion(item)}
                  className="flex items-center text-left px-4 py-3 hover:bg-cyan-900/30 transition-colors border-b border-white/5 last:border-b-0 group/item"
                >
                  <div className={`p-2 rounded-lg mr-3 ${item.type === 'vehicle' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                    {item.type === 'vehicle' ? <Navigation className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase mt-0.5">
                      {item.type === 'vehicle' ? 'Araç Filosu' : 'Harita Sonucu'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom KPI Cards */}
      <div className={`absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center transition-all duration-500 ease-in-out ${showCards ? 'translate-y-0' : 'translate-y-[120px]'}`}>
        
        {/* Drawer Toggle Handle */}
        <button 
          onClick={() => setShowCards(!showCards)}
          className="mb-2 bg-[#050B14]/90 backdrop-blur-xl border border-cyan-500/30 border-b-0 rounded-t-xl px-6 py-1.5 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-950/60 shadow-[0_-5px_15px_rgba(6,182,212,0.15)] transition-all cursor-pointer pointer-events-auto group"
          title={showCards ? "İstatistikleri Gizle" : "İstatistikleri Göster"}
        >
          {showCards ? <ChevronDown className="w-4 h-4 group-hover:drop-shadow-[0_0_5px_currentColor]" /> : <ChevronUp className="w-4 h-4 group-hover:drop-shadow-[0_0_5px_currentColor]" />}
          <span className="text-[10px] uppercase font-bold tracking-widest ml-2 group-hover:drop-shadow-[0_0_5px_currentColor]">{showCards ? "Gizle" : "Göster"}</span>
        </button>

        {/* The Cards themselves */}
        <div className="w-full px-8 pointer-events-none">
          <div className="flex flex-col xl:flex-row gap-4 w-full max-w-7xl mx-auto pointer-events-auto">
            <KPICard title="Toplam Araç" value={totalVehicles} icon={Navigation} color="blue" />
            <KPICard title="Hareket Halinde" value={movingVehicles} icon={Activity} color="emerald" />
            <KPICard title="Hız İhlali / Alarm" value={speedingAlarms} icon={AlertTriangle} color="red" />
            <KPICard title="Sistem Sağlığı" value={serverStatus} icon={CheckCircle} color="purple" />
          </div>
        </div>

      </div>
    </div>
  );
}
