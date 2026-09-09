"use client";
import React, { useState, useEffect } from 'react';
import { Wifi, Activity, Battery, Signal, Zap } from 'lucide-react';

const BACKEND = '/api/proxy';

export default function HealthPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/devices/health`).then(r => r.json()).then(data => {
      setDevices(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'idle': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'offline': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getSignalIcon = (quality: string) => {
    if (quality === 'excellent') return <Signal className="w-5 h-5 text-emerald-400" />;
    if (quality === 'good') return <Signal className="w-5 h-5 text-blue-400 opacity-80" />;
    if (quality === 'weak') return <Signal className="w-5 h-5 text-orange-400 opacity-60" />;
    return <Wifi className="w-5 h-5 text-red-400 opacity-40" />;
  };

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)]">
              <Activity className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Cihaz Sağlığı & Telemetri</h1>
              <p className="text-slate-400 text-sm mt-1">GT06N cihazlarının anlık bağlantı durumları, veri kalitesi ve teşhis bilgileri.</p>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 text-slate-500">Cihaz verileri analiz ediliyor...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-20 text-slate-500">Cihaz bulunamadı.</div>
          ) : devices.map(d => {
            const statusClass = getStatusColor(d.connectionStatus);
            return (
              <div key={d.imei} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col lg:flex-row items-center justify-between gap-6 hover:bg-white/[0.04] transition-colors">
                
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${d.connectionStatus === 'online' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : d.connectionStatus === 'offline' ? 'bg-red-500' : 'bg-orange-500'}`} />
                  <div>
                    <h3 className="text-lg font-bold text-white">{d.plate || 'Bilinmeyen Araç'}</h3>
                    <p className="text-xs font-mono text-slate-400">IMEI: {d.imei}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto flex-1">
                  
                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Durum</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border inline-block uppercase ${statusClass}`}>
                      {d.connectionStatus === 'online' ? 'Çevrimiçi' : d.connectionStatus === 'offline' ? 'Çevrimdışı' : 'Uyku Modu'}
                    </span>
                  </div>

                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Son Sinyal</p>
                    <p className="text-sm font-mono text-white">{d.last_update ? new Date(d.last_update).toLocaleTimeString('tr-TR') : 'Yok'}</p>
                    <p className="text-[10px] text-slate-400">{d.seconds_since_update ? Math.floor(d.seconds_since_update / 60) + ' dk önce' : '-'}</p>
                  </div>

                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">GPS Kalitesi</p>
                    <div className="flex items-center gap-2">
                      {getSignalIcon(d.signalQuality)}
                      <span className="text-sm font-bold text-white">{d.today_positions} <span className="text-[10px] text-slate-400 font-normal">paket/gün</span></span>
                    </div>
                  </div>

                  <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Hata/Alarm</p>
                    <div className="flex items-center gap-2">
                      <Zap className={`w-5 h-5 ${d.open_alarms > 0 ? 'text-red-400' : 'text-slate-600'}`} />
                      <span className={`text-sm font-bold ${d.open_alarms > 0 ? 'text-red-400' : 'text-slate-400'}`}>{d.open_alarms} Açık</span>
                    </div>
                  </div>

                </div>

                <div className="w-full lg:w-auto flex lg:flex-col gap-2 shrink-0">
                  <button className="flex-1 lg:w-full px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg transition-colors border border-blue-500/20">Cihazı Yeniden Başlat (SMS)</button>
                  <button className="flex-1 lg:w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors border border-slate-700">Ham Logları İncele</button>
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
