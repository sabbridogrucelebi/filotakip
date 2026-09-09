"use client";
import React, { useState, useEffect } from 'react';
import { Truck, Search, Filter, Plus, Edit, Trash2, MapPin, Phone, Fuel, Gauge, Users, ChevronRight } from 'lucide-react';

const BACKEND = '/api/proxy';

const vehicleTypeIcons: Record<string, string> = {
  car: '🚗', truck: '🚛', bus: '🚌', van: '🚐', motorcycle: '🏍️'
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/vehicles`).then(r => r.json()),
      fetch(`${BACKEND}/vehicle-groups`).then(r => r.json()),
    ]).then(([v, g]) => {
      setVehicles(Array.isArray(v) ? v : []);
      setGroups(Array.isArray(g) ? g : []);
      setLoading(false);
    });
  }, []);

  const filtered = vehicles.filter(v => {
    const matchSearch = !search || v.plate?.toLowerCase().includes(search.toLowerCase()) || v.imei?.includes(search) || v.driver_name?.toLowerCase().includes(search.toLowerCase());
    const matchGroup = !filterGroup || String(v.group_id) === filterGroup;
    return matchSearch && matchGroup;
  });

  const stats = {
    total: vehicles.length,
    moving: vehicles.filter(v => v.speed > 0).length,
    stopped: vehicles.filter(v => v.speed === 0 && v.ignition).length,
    offline: vehicles.filter(v => !v.lat).length,
  };

  const getStatusColor = (v: any) => {
    if (!v.lat) return { bg: 'from-slate-500/20 to-slate-600/10', border: 'border-slate-500/30', dot: 'bg-slate-500', text: 'text-slate-400', label: 'Çevrimdışı' };
    if (v.speed > 0) return { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', dot: 'bg-blue-500', text: 'text-blue-400', label: 'Hareket' };
    if (v.ignition) return { bg: 'from-orange-500/20 to-orange-600/10', border: 'border-orange-500/30', dot: 'bg-orange-500', text: 'text-orange-400', label: 'Rölanti' };
    return { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', dot: 'bg-red-500', text: 'text-red-400', label: 'Park' };
  };

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)]">
              <Truck className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Araç Yönetimi</h1>
              <p className="text-slate-400 text-sm mt-1">Filonuzdaki tüm araçları yönetin</p>
            </div>
          </div>
          <a href="/dashboard/settings" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Yeni Araç Ekle
          </a>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Toplam Araç', value: stats.total, color: '#3b82f6', icon: '🚗' },
            { label: 'Hareket', value: stats.moving, color: '#10b981', icon: '🟢' },
            { label: 'Rölanti', value: stats.stopped, color: '#f59e0b', icon: '🟠' },
            { label: 'Çevrimdışı', value: stats.offline, color: '#ef4444', icon: '🔴' },
          ].map((s, i) => (
            <div key={i} className="bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-white/20 transition-all">
              <div className="absolute top-0 left-0 w-1 h-full rounded-r-full" style={{ background: s.color }} />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.label}</p>
                  <p className="text-3xl font-black text-white mt-1">{s.value}</p>
                </div>
                <span className="text-3xl opacity-60 group-hover:scale-110 transition-transform">{s.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Plaka, IMEI veya şoför ara..." className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 text-sm" />
          </div>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50 appearance-none cursor-pointer min-w-[180px]">
            <option value="">Tüm Gruplar</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.vehicle_count})</option>)}
          </select>
        </div>

        {/* Vehicle List */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-20 text-slate-500">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-500">Araç bulunamadı</div>
          ) : filtered.map(v => {
            const status = getStatusColor(v);
            return (
              <div key={v.id || v.imei} className={`bg-gradient-to-r ${status.bg} backdrop-blur-xl border ${status.border} rounded-2xl p-5 hover:scale-[1.01] transition-all cursor-pointer group`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{vehicleTypeIcons[v.vehicle_type] || '🚗'}</div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-white tracking-wide">{v.plate || v.imei}</h3>
                        <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${status.text} bg-black/30`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-pulse`} />
                          {status.label}
                        </span>
                        {v.group_name && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-400">{v.group_name}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                        {v.vehicle_model && <span>{v.vehicle_model} {v.vehicle_year}</span>}
                        {v.driver_name && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{v.driver_name}</span>}
                        {v.driver_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{v.driver_phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-2xl font-black text-white">{v.speed || 0} <span className="text-xs text-slate-500 font-bold">km/h</span></p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{v.last_update ? new Date(v.last_update).toLocaleString('tr-TR') : 'Sinyal yok'}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
