"use client";
import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';

const BACKEND = '/api/proxy';

export default function POIPage() {
  const [pois, setPois] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/poi`).then(r => r.json()).then(data => {
      setPois(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const getIcon = (category: string) => {
    const icons: any = { depot: '🏭', customer: '🤝', office: '🏢', parking: '🅿️', gas_station: '⛽', general: '📍' };
    return icons[category] || '📍';
  };

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500/20 to-rose-500/10 border border-pink-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(236,72,153,0.15)]">
              <MapPin className="w-7 h-7 text-pink-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">İlgi Noktaları (POI)</h1>
              <p className="text-slate-400 text-sm mt-1">Harita üzerindeki önemli adresleri (depo, müşteri vb.) kaydedin.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:shadow-[0_0_30px_rgba(236,72,153,0.5)] transition-all flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Yeni Nokta Ekle
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Yükleniyor...</div>
        ) : pois.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-xl font-bold text-white mb-2">Henüz İlgi Noktası Yok</h3>
            <p className="text-slate-500 mb-6">Müşterilerinizi, depolarınızı veya ofislerinizi haritaya ekleyerek araçların bu noktalara varışını takip edebilirsiniz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pois.map(poi => (
              <div key={poi.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:border-pink-500/30 hover:bg-white/[0.04] transition-all group">
                <div className="text-5xl mb-4 text-center group-hover:scale-110 transition-transform">{getIcon(poi.category)}</div>
                <h3 className="text-lg font-bold text-white text-center mb-1">{poi.name}</h3>
                <p className="text-xs text-slate-400 text-center mb-4">{poi.description || 'Açıklama yok'}</p>
                
                <div className="bg-black/30 rounded-xl p-3 text-center mb-4">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Bildirim Yarıçapı</p>
                  <p className="text-sm font-bold text-pink-400">{poi.radius} Metre</p>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-colors">Haritada Gör</button>
                  <button className="w-10 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
