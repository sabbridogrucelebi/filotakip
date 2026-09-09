"use client";
import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, ShieldAlert, Zap, Clock, CheckCircle2, Search, Filter } from 'lucide-react';

const BACKEND = '/api/proxy';

const alarmIcons: Record<string, { icon: string, bg: string, border: string, text: string }> = {
  speed: { icon: '🚨', bg: 'from-red-500/20 to-rose-600/10', border: 'border-red-500/30', text: 'text-red-400' },
  geofence_enter: { icon: '📥', bg: 'from-blue-500/20 to-indigo-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  geofence_exit: { icon: '📤', bg: 'from-orange-500/20 to-amber-600/10', border: 'border-orange-500/30', text: 'text-orange-400' },
  idle: { icon: '⏳', bg: 'from-yellow-500/20 to-amber-600/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  disconnect: { icon: '🔌', bg: 'from-slate-500/20 to-gray-600/10', border: 'border-slate-500/30', text: 'text-slate-400' },
  default: { icon: '⚠️', bg: 'from-purple-500/20 to-fuchsia-600/10', border: 'border-purple-500/30', text: 'text-purple-400' }
};

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('unresolved');

  const fetchAlarms = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (filterType) query.append('type', filterType);
      if (filterStatus !== 'all') query.append('resolved', filterStatus === 'resolved' ? 'true' : 'false');
      
      const res = await fetch(`${BACKEND}/alarms?${query.toString()}`);
      const data = await res.json();
      setAlarms(data.alarms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlarms();
    
    // Mark as read when opening page
    fetch(`${BACKEND}/alarms/read-all`, { method: 'PUT' });
  }, [filterType, filterStatus]);

  const handleResolve = async (id: number) => {
    try {
      await fetch(`${BACKEND}/alarms/${id}/resolve`, { method: 'PUT' });
      setAlarms(alarms.map(a => a.id === id ? { ...a, is_resolved: 1 } : a));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.15)]">
              <Bell className="w-7 h-7 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Alarm Merkezi</h1>
              <p className="text-slate-400 text-sm mt-1">Sistem tarafından algılanan tüm kural ihlalleri ve uyarılar</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-bold mr-4">
            <Filter className="w-4 h-4" /> Filtrele:
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
            <option value="unresolved">🔴 Çözülmemiş</option>
            <option value="resolved">🟢 Çözüldü</option>
            <option value="all">⚪ Tümü</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer">
            <option value="">Tüm Alarm Tipleri</option>
            <option value="speed">Hız İhlali</option>
            <option value="geofence_enter">Bölge Girişi</option>
            <option value="geofence_exit">Bölge Çıkışı</option>
            <option value="idle">Uzun Rölanti</option>
            <option value="disconnect">Bağlantı Kopması</option>
          </select>
        </div>

        {/* Alarms List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-20 text-slate-500">Alarmlar yükleniyor...</div>
          ) : alarms.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-white mb-2">Harika! Her şey yolunda.</h3>
              <p className="text-slate-500">Seçili filtrelere uygun alarm bulunamadı.</p>
            </div>
          ) : alarms.map(alarm => {
            const style = alarmIcons[alarm.alarm_type] || alarmIcons.default;
            return (
              <div key={alarm.id} className={`bg-gradient-to-r ${style.bg} backdrop-blur-xl border ${style.border} rounded-2xl p-5 lg:p-6 transition-all flex flex-col lg:flex-row gap-6 lg:items-center justify-between ${alarm.is_resolved ? 'opacity-60 grayscale-[0.5]' : 'shadow-[0_10px_30px_rgba(0,0,0,0.2)]'}`}>
                
                <div className="flex items-start gap-5">
                  <div className="text-4xl shrink-0 mt-1">{style.icon}</div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <h3 className={`text-lg font-black ${style.text}`}>{alarm.title}</h3>
                      <span className="text-xs font-bold text-white bg-white/10 px-2 py-0.5 rounded-md tracking-wider">
                        {alarm.plate || alarm.device_imei}
                      </span>
                      {alarm.severity === 'critical' && <span className="text-[10px] font-black bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">KRİTİK</span>}
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">{alarm.description}</p>
                    
                    <div className="flex items-center gap-6 mt-3 text-xs text-slate-400 font-mono">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(alarm.event_time).toLocaleString('tr-TR')}</span>
                      {alarm.speed > 0 && <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {alarm.speed} km/h</span>}
                    </div>
                  </div>
                </div>

                <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 shrink-0 gap-4">
                  {!alarm.is_resolved ? (
                    <button 
                      onClick={() => handleResolve(alarm.id)}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 text-sm w-full lg:w-auto justify-center"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Çözüldü İşaretle
                    </button>
                  ) : (
                    <div className="text-emerald-500/80 font-bold text-sm flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Çözüldü
                    </div>
                  )}
                  {alarm.latitude && (
                    <a href={`/dashboard?lat=${alarm.latitude}&lng=${alarm.longitude}`} className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">
                      Haritada Gör →
                    </a>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
