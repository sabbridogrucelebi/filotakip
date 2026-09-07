"use client";
import React, { useState } from 'react';
import { Map, Truck, Activity, Settings, LogOut, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const navItems = [
    { name: 'Canlı Harita', icon: Map, path: '/dashboard' },
    { name: 'Ayarlar (Cihaz Ekle)', icon: Settings, path: '/dashboard/settings' },
  ];

  return (
    <div 
      className={`fixed top-0 left-0 h-screen bg-[#02040a]/80 backdrop-blur-3xl border-r border-blue-500/10 shadow-[20px_0_40px_rgba(0,0,0,0.5)] transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] z-50 flex flex-col ${isCollapsed ? '-translate-x-[280px]' : 'translate-x-0'} w-[300px]`}
    >  <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/50 to-transparent"></div>

      {/* Collapse Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-10 w-6 h-12 bg-[#02040a] border border-blue-500/30 rounded-r-xl flex items-center justify-center text-blue-400 hover:text-white hover:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <div className="px-4 lg:px-6 relative z-10 flex flex-col h-full">
        
        {/* Brand Logo */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center mb-8' : 'gap-4 mb-12 lg:justify-start lg:px-2'} transition-all`}>
          <div className="w-10 h-10 rounded-xl bg-[#02040a] border border-blue-500/50 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-blue-500/20 hover:bg-blue-500/40 transition-colors"></div>
            <LayoutDashboard className="text-blue-400 w-5 h-5 relative z-10" />
          </div>
          {!isCollapsed && (
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-300 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] truncate">
              FiloTakip
            </h1>
          )}
        </div>
        
        {/* Navigation */}
        <nav className="space-y-3 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-4 py-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${isActive ? 'bg-blue-900/20 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                
                {/* Hover / Active background glow */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} bg-gradient-to-r from-blue-500/10 to-transparent`}></div>
                
                {/* Active edge marker */}
                {isActive && (
                  <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-blue-400 rounded-r-full shadow-[0_0_10px_rgba(96,165,250,1)]"></div>
                )}

                <Icon className={`w-5 h-5 flex-shrink-0 relative z-10 transition-colors duration-300 ${isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {!isCollapsed && (
                  <span className={`font-bold text-sm relative z-10 tracking-wide transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}>{item.name}</span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Logout */}
      <div className="px-4 lg:px-6 relative z-10 mt-auto">
        <Link href="/" className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} px-4 py-4 rounded-2xl text-slate-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all duration-300 group`}>
          <LogOut className="w-5 h-5 flex-shrink-0 text-slate-500 group-hover:text-red-400 transition-colors" />
          {!isCollapsed && (
            <span className="font-bold text-sm tracking-wide whitespace-nowrap">Çıkış Yap</span>
          )}
        </Link>
      </div>
    </div>
  );
}
