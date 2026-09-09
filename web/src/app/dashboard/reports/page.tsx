"use client";
import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Zap, Calendar, Download, Map as MapIcon, ShieldAlert } from 'lucide-react';

const BACKEND = '/api/proxy';

export default function ReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/reports/dashboard-stats`).then(r => r.json()).then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.15)]">
              <BarChart3 className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Raporlar & Analiz</h1>
              <p className="text-slate-400 text-sm mt-1">Filo performansınızı verilerle yönetin.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/10 transition-all flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> PDF Dışa Aktar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Veriler hazırlanıyor...</div>
        ) : stats ? (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-900/40 to-black border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-8xl opacity-10">🛣️</div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Bugünkü Toplam Mesafe</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{stats.todayDistance?.toFixed(0) || 0}</span>
                  <span className="text-slate-400 font-bold">km</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-900/40 to-black border border-red-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-8xl opacity-10">🚨</div>
                <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Bugünkü Alarmlar</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{stats.alarms?.today || 0}</span>
                  <span className="text-slate-400 font-bold">adet</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-900/40 to-black border border-emerald-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-8xl opacity-10">🚚</div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Aktif / Toplam Araç</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{stats.vehicles?.moving + stats.vehicles?.stopped}</span>
                  <span className="text-slate-400 font-bold">/ {stats.vehicles?.total}</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-900/40 to-black border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 text-8xl opacity-10">⚠️</div>
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">Çözülmemiş İhlaller</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">{stats.alarms?.unresolved || 0}</span>
                  <span className="text-slate-400 font-bold">adet</span>
                </div>
              </div>
            </div>

            {/* Quick Reports List */}
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><TrendingUp className="text-indigo-400" /> Hazır Rapor Şablonları</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {[
                { title: 'Günlük Filo Özeti', desc: 'Tüm araçların bugün yaptığı km, kontak süreleri ve ihlalleri.', icon: '📊', color: 'blue' },
                { title: 'Hız İhlalleri Raporu', desc: 'Limitleri aşan araçların saat, konum ve hız detayları.', icon: '⚡', color: 'red' },
                { title: 'Yakıt Tüketim Tahmini', desc: 'Araçların kat ettiği mesafeye göre tahmini yakıt maliyetleri.', icon: '⛽', color: 'emerald' },
                { title: 'Geofence Giriş/Çıkış', desc: 'Sanal bölgelere hangi aracın ne zaman girip çıktığı.', icon: '🗺️', color: 'purple' },
                { title: 'Rölanti Raporu', desc: 'Kontak açık halde gereksiz bekleme yapan araçlar ve süreleri.', icon: '⏳', color: 'orange' },
                { title: 'Şoför Performansı', desc: 'Şoför bazında ihlal puanlaması ve çalışma saatleri.', icon: '👨‍✈️', color: 'cyan' },
              ].map((r, i) => (
                <div key={i} className="bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl p-6 cursor-pointer transition-all hover:border-white/20 group">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-4xl group-hover:scale-110 transition-transform">{r.icon}</div>
                    <h3 className="text-lg font-bold text-white">{r.title}</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed mb-6">{r.desc}</p>
                  <button className="w-full py-3 bg-white/5 group-hover:bg-indigo-600/20 text-white font-bold rounded-xl transition-colors text-sm border border-transparent group-hover:border-indigo-500/50">
                    Raporu Oluştur
                  </button>
                </div>
              ))}

            </div>
          </>
        ) : null}

      </div>
    </div>
  );
}
