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
  const [showCards, setShowCards] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState("%0.0"); // Just a fun metric

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
        <LiveMap vehicles={vehicles} />
      </div>

      {/* Top Search Bar */}
      <div className="absolute top-6 left-0 right-0 z-20 flex justify-center pointer-events-none px-4">
        <div className="w-full max-w-2xl bg-[#050B14]/80 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex items-center gap-2 group focus-within:border-cyan-500/70 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all">
          <div className="pl-4">
            <Search className="w-5 h-5 text-cyan-500 group-focus-within:text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] transition-colors" />
          </div>
          <input 
            type="text"
            placeholder="Araç Plakası veya IMEI Ara..." 
            className="w-full bg-transparent border-none text-white placeholder-slate-500 focus:outline-none py-2 px-2 font-mono text-sm tracking-wide"
          />
          <button className="bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 px-6 py-2 rounded-xl text-xs font-bold tracking-widest uppercase transition-colors shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            Ara
          </button>
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
