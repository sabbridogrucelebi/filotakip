"use client";
import React, { useState, useEffect } from 'react';
import { Wrench, Plus, CheckCircle, AlertTriangle, Clock, Trash2, Edit } from 'lucide-react';

const BACKEND = '/api/proxy';

export default function MaintenancePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND}/maintenance`).then(r => r.json()).then(data => {
      setRecords(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const getStatus = (record: any) => {
    if (record.is_completed) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle className="w-4 h-4"/>, text: 'Tamamlandı' };
    
    const now = new Date();
    const nextDate = record.next_service_date ? new Date(record.next_service_date) : null;
    if (nextDate && nextDate < now) {
      return { color: 'text-red-400', bg: 'bg-red-500/10', icon: <AlertTriangle className="w-4 h-4"/>, text: 'Gecikti' };
    }
    
    return { color: 'text-orange-400', bg: 'bg-orange-500/10', icon: <Clock className="w-4 h-4"/>, text: 'Yaklaşıyor' };
  };

  const getIcon = (type: string) => {
    const icons: any = { oil_change: '🛢️', tire_change: '🛞', brake: '🛑', inspection: '📋', insurance: '🛡️', general: '🔧' };
    return icons[type] || '🔧';
  };

  return (
    <div className="w-full h-full bg-[#02040a] overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 lg:p-10">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
              <Wrench className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Bakım & Servis</h1>
              <p className="text-slate-400 text-sm mt-1">Araç periyodik bakımları, muayene ve sigorta takibi.</p>
            </div>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Yeni Kayıt Ekle
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-500">Kayıtlar yükleniyor...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl">
            <div className="text-6xl mb-4">🔧</div>
            <h3 className="text-xl font-bold text-white mb-2">Henüz Bakım Kaydı Yok</h3>
            <p className="text-slate-500 mb-6">Araçlarınızın yağ değişimi, muayene gibi kayıtlarını buradan takip edebilirsiniz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {records.map(r => {
              const status = getStatus(r);
              return (
                <div key={r.id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 hover:bg-white/[0.04] transition-all hover:border-amber-500/30 group relative overflow-hidden">
                  
                  {/* Accent Line */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${r.is_completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{getIcon(r.type)}</div>
                      <div>
                        <h3 className="text-lg font-bold text-white leading-tight">{r.title}</h3>
                        <span className="text-xs font-bold bg-white/10 text-white px-2 py-0.5 rounded-md mt-1 inline-block">{r.plate || r.device_imei}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${status.bg} ${status.color}`}>
                      {status.icon} {status.text}
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {r.service_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Yapıldığı Tarih:</span>
                        <span className="font-bold text-white">{new Date(r.service_date).toLocaleDateString('tr-TR')}</span>
                      </div>
                    )}
                    {r.next_service_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Sonraki Tarih:</span>
                        <span className="font-bold text-amber-400">{new Date(r.next_service_date).toLocaleDateString('tr-TR')}</span>
                      </div>
                    )}
                    {r.cost > 0 && (
                      <div className="flex justify-between text-sm border-t border-white/5 pt-2 mt-2">
                        <span className="text-slate-500">Maliyet:</span>
                        <span className="font-bold text-emerald-400">{r.cost} {r.currency}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                      <Edit className="w-3 h-3" /> Düzenle
                    </button>
                    <button className="w-10 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center justify-center">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
