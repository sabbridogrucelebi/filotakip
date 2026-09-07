"use client";
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Activity, AlertTriangle, CheckCircle, Navigation, EyeOff, Eye } from 'lucide-react';
import { io } from 'socket.io-client';

// Dynamically import Leaflet Map to avoid SSR window is not defined error
const LiveMap = dynamic(() => import('@/components/dashboard/LiveMap'), { ssr: false });

function KPICard({ title, value, icon: Icon, color }: any) {
  const colorStyles = {
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    red: 'text-red-400 bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)] hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
  };
  
  return (
    <div className={`flex-1 bg-[#02040a]/80 backdrop-blur-2xl border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 cursor-default relative overflow-hidden group ${colorStyles[color as keyof typeof colorStyles]}`}>
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-current opacity-50 group-hover:opacity-100 transition-opacity`}></div>
      <div className="flex justify-between items-start mb-3 relative z-10">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.15em]">{title}</p>
        <div className={`p-2 rounded-xl bg-[#02040a] border border-current shadow-[0_0_10px_currentColor]`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-lg relative z-10">{value}</h3>
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

      {/* Top Cards Container */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex flex-col items-center transition-all duration-500 ease-in-out ${showCards ? 'translate-y-0' : '-translate-y-[120px]'}`}>
        
        {/* The Cards themselves */}
        <div className="w-full pt-6 px-8 pointer-events-none">
          <div className="flex flex-col xl:flex-row gap-4 w-full max-w-7xl mx-auto pointer-events-auto">
            <KPICard title="Toplam Araç" value={totalVehicles} icon={Navigation} color="blue" />
            <KPICard title="Hareket Halinde" value={movingVehicles} icon={Activity} color="emerald" />
            <KPICard title="Hız İhlali / Alarm" value={speedingAlarms} icon={AlertTriangle} color="red" />
            <KPICard title="Sistem Sağlığı" value={serverStatus} icon={CheckCircle} color="purple" />
          </div>
        </div>

        {/* Drawer Toggle Handle */}
        <button 
          onClick={() => setShowCards(!showCards)}
          className="mt-2 bg-[#02040a]/90 backdrop-blur-xl border border-blue-500/30 border-t-0 rounded-b-xl px-6 py-1.5 flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-900/40 shadow-[0_5px_15px_rgba(59,130,246,0.2)] transition-all cursor-pointer pointer-events-auto"
          title={showCards ? "İstatistikleri Gizle" : "İstatistikleri Göster"}
        >
          {showCards ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span className="text-[10px] uppercase font-bold tracking-widest ml-2">{showCards ? "Gizle" : "Göster"}</span>
        </button>

      </div>
    </div>
  );
}
