"use client";
import React, { useState } from 'react';
import { Map, Truck, Activity, Settings, LogOut, LayoutDashboard, ChevronLeft, ChevronRight, User, Bell, Route, Shield, BarChart3, Wrench, MapPin, Wifi } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const navItems = [
    { name: 'Canlı Harita', icon: Map, path: '/dashboard' },
    { name: 'Araç Yönetimi', icon: Truck, path: '/dashboard/vehicles' },
    { name: 'Alarmlar', icon: Bell, path: '/dashboard/alarms' },
    { name: 'Rota Geçmişi', icon: Route, path: '/dashboard/history' },
    { name: 'Geofence', icon: Shield, path: '/dashboard/geofences' },
    { name: 'Raporlar', icon: BarChart3, path: '/dashboard/reports' },
    { name: 'Bakım & Servis', icon: Wrench, path: '/dashboard/maintenance' },
    { name: 'İlgi Noktaları', icon: MapPin, path: '/dashboard/poi' },
    { name: 'Cihaz Sağlığı', icon: Wifi, path: '/dashboard/health' },
    { name: 'Ayarlar', icon: Settings, path: '/dashboard/settings' },
  ];

  return (
    <div 
      className={`fixed top-0 left-0 h-screen bg-[#050B14]/70 backdrop-blur-3xl border-r border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] z-50 flex flex-col ${isCollapsed ? '-translate-x-[280px]' : 'translate-x-0'} w-[300px] group/sidebar`}
    >
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>

      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-4 top-12 w-8 h-16 bg-[#050B14] border border-cyan-500/40 rounded-r-2xl flex items-center justify-center text-cyan-400 hover:text-white hover:bg-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all z-50 cursor-pointer overflow-hidden group/btn"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 to-cyan-500/10 group-hover/btn:to-cyan-500/30 transition-colors"></div>
        {isCollapsed ? <ChevronRight className="w-5 h-5 relative z-10" /> : <ChevronLeft className="w-5 h-5 relative z-10" />}
      </button>

      <div className="px-4 lg:px-6 relative z-10 flex flex-col h-full pt-10">
        
        {/* Brand Logo */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center mb-10' : 'gap-4 mb-14 lg:justify-start lg:px-2'} transition-all`}>
          <div className="w-12 h-12 rounded-2xl bg-[#050B14] border border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-cyan-500/20 group-hover/sidebar:bg-cyan-500/30 transition-colors animate-pulse"></div>
            <LayoutDashboard className="text-cyan-400 w-6 h-6 relative z-10 drop-shadow-[0_0_5px_rgba(6,182,212,1)]" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 tracking-tighter drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] truncate">
                FiloTakip
              </h1>
              <div className="text-[10px] text-cyan-500/70 font-mono tracking-widest uppercase mt-1">v2.0 Cyberpunk</div>
            </div>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="space-y-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-4 py-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${isActive ? 'bg-cyan-950/40 border border-cyan-500/50 shadow-[inset_0_0_20px_rgba(6,182,212,0.2)]' : 'hover:bg-cyan-900/20 border border-transparent hover:border-cyan-500/20'}`}>
                
                {/* Hover / Active background glow */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} bg-gradient-to-r from-cyan-500/10 to-transparent`}></div>
                
                {/* Active edge marker */}
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-cyan-400 rounded-r-full shadow-[0_0_15px_rgba(6,182,212,1)]"></div>
                )}

                <Icon className={`w-6 h-6 flex-shrink-0 relative z-10 transition-all duration-300 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'text-slate-500 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]'}`} />
                {!isCollapsed && (
                  <span className={`font-bold text-sm relative z-10 tracking-wider transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-cyan-100'}`}>{item.name}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User Profile Section */}
        <div className={`mt-auto mb-6 pt-6 border-t border-cyan-500/20 ${isCollapsed ? 'hidden' : 'block'}`}>
          <div className="flex items-center gap-4 px-2">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-900 p-[2px] shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <div className="w-full h-full bg-[#050B14] rounded-full flex items-center justify-center overflow-hidden">
                <User className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="text-white font-bold text-sm">Patron</div>
              <div className="text-cyan-500 text-xs font-mono">Sistem Yöneticisi</div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className={`px-2 pb-6 relative z-10`}>
          <Link href="/" className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-4 py-4 rounded-2xl text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/30 shadow-[inset_0_0_0_rgba(244,63,94,0)] hover:shadow-[inset_0_0_20px_rgba(244,63,94,0.1)] transition-all duration-300 group`}>
            <LogOut className="w-6 h-6 flex-shrink-0 text-slate-500 group-hover:text-rose-400 group-hover:drop-shadow-[0_0_8px_rgba(244,63,94,0.6)] transition-all" />
            {!isCollapsed && (
              <span className="font-bold text-sm tracking-widest uppercase whitespace-nowrap group-hover:text-rose-300">Sistemden Çık</span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
