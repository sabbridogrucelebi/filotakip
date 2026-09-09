"use client";
import React, { useState, useEffect } from 'react';
import { Shield, Plus, Map as MapIcon, Trash2, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';

const BACKEND = '/api/proxy';

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/geofences`).then(r => r.json()).then(data => {
      setGeofences(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const toggleActive = async (id: number, current: boolean) => {
    try {
      // Find full geofence data to update just the is_active flag
      const gf = geofences.find(g => g.id === id);
      await fetch(`${BACKEND}/geofences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gf, is_active: !current })
      });
      setGeofences(geofences.map(g => g.id === id ? { ...g, is_active: !current ? 1 : 0 } : g));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteGeofence = async (id: number) => {
    if (!confirm('Bu sanal çiti silmek istediğinize emin misiniz?')) return;
    try {
      await fetch(`${BACKEND}/geofences/${id}`, { method: 'DELETE' });
      setGeofences(geofences.filter(g => g.id !== id));
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
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
              <Shield className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Geofence (Sanal Çit)</h1>
              <p className="text-slate-400 text-sm mt-1">Harita üzerinde izole bölgeler tanımlayın ve giriş/çıkış alarmları alın.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Yeni Bölge Çiz
          </button>
        </div>

        {/* List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-20 text-slate-500">Yükleniyor...</div>
          ) : geofences.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <MapIcon className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Henüz Bölge Tanımlanmamış</h3>
              <p className="text-slate-500 mb-6">Araçlarınızın girmesini veya çıkmasını istemediğiniz bölgeleri haritada çizin.</p>
              <button className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all">
                İlk Bölgeyi Oluştur
              </button>
            </div>
          ) : geofences.map(gf => (
            <div key={gf.id} className={`bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl p-6 transition-all group ${!gf.is_active ? 'opacity-50' : 'hover:border-emerald-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.2)]'}`}>
              
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{gf.type === 'circle' ? '⭕' : '🔲'}</div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{gf.name}</h3>
                    <p className="text-xs text-slate-400">{gf.type === 'circle' ? `Yarıçap: ${gf.radius}m` : 'Çokgen Bölge'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleActive(gf.id, !!gf.is_active)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${gf.is_active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${gf.is_active ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Giriş Alarmı</span>
                  <span className="font-bold text-white">{gf.alert_on_enter ? 'Açık' : 'Kapalı'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-orange-500" /> Çıkış Alarmı</span>
                  <span className="font-bold text-white">{gf.alert_on_exit ? 'Açık' : 'Kapalı'}</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-3 border-t border-white/5">
                  <span className="text-slate-500">Bağlı Araçlar</span>
                  <span className="font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg">{gf.devices?.length || 0} Araç</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4" /> Düzenle
                </button>
                <button onClick={() => deleteGeofence(gf.id)} className="w-12 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
