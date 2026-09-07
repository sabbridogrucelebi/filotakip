"use client";
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, MapPin, CheckCircle, Smartphone, User, Car, Hash, Info, ShieldCheck, Settings, AlertTriangle } from 'lucide-react';

const MiniMap = dynamic(() => import('@/components/dashboard/MiniMap'), { ssr: false });

export default function SettingsPage() {
  const [step, setStep] = useState(1);
  const [imei, setImei] = useState('');
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    plate: '',
    model: '',
    year: '',
    driver_name: '',
    driver_phone: '',
    sim: ''
  });

  const handleSearch = async () => {
    if (!imei || imei.length < 10) {
      setError('Geçerli bir IMEI numarası giriniz.');
      return;
    }
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`http://localhost:3001/api/devices/locate/${imei}`);
      const data = await res.json();
      
      if (res.ok && data.lat) {
        setLocation(data);
        setStep(2);
      } else {
        setError(data.error || 'Cihaz hiç veri göndermemiş. Lütfen güce bağlayıp bekleyin.');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLocation = () => {
    setStep(3);
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/devices/${imei}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setStep(4); // Success!
      } else {
        setError('Kayıt başarısız oldu.');
      }
    } catch (err) {
      setError('Kayıt işlemi sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({ icon: Icon, label, name, type = "text", placeholder }: any) => (
    <div className="relative group">
      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 block ml-1">{label}</label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
        </div>
        <input
          type={type}
          placeholder={placeholder}
          value={formData[name as keyof typeof formData]}
          onChange={(e) => setFormData({ ...formData, [name]: e.target.value })}
          className="w-full bg-[#0a0f1c]/50 border border-slate-700 focus:border-blue-500/50 rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
        />
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-[#02040a] p-8 lg:p-12 overflow-y-auto relative">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        <header className="mb-12 text-center lg:text-left flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)]">
            <Settings className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Yeni Cihaz Tanımlama</h1>
            <p className="text-slate-400 mt-2 font-medium">GT06N GPS cihazınızı sisteme kaydedin ve filoya bağlayın.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Steps Indicator */}
          <div className="lg:col-span-1 hidden lg:block">
            <div className="bg-white/5 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl sticky top-8">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">Kurulum Aşamaları</h3>
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
                
                {/* Step 1 Indicator */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 ${step >= 1 ? 'bg-[#02040a] border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800'} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors`}>
                    <Search className={`w-4 h-4 ${step >= 1 ? 'text-blue-400' : 'text-slate-600'}`} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl">
                    <h4 className={`font-bold ${step >= 1 ? 'text-white' : 'text-slate-500'}`}>Cihazı Bul</h4>
                  </div>
                </div>

                {/* Step 2 Indicator */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 ${step >= 2 ? 'bg-[#02040a] border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800'} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors`}>
                    <MapPin className={`w-4 h-4 ${step >= 2 ? 'text-blue-400' : 'text-slate-600'}`} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl">
                    <h4 className={`font-bold ${step >= 2 ? 'text-white' : 'text-slate-500'}`}>Konum Doğrulama</h4>
                  </div>
                </div>

                {/* Step 3 Indicator */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 ${step >= 3 ? 'bg-[#02040a] border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-slate-900 border-slate-800'} shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors`}>
                    <Info className={`w-4 h-4 ${step >= 3 ? 'text-blue-400' : 'text-slate-600'}`} />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl">
                    <h4 className={`font-bold ${step >= 3 ? 'text-white' : 'text-slate-500'}`}>Şoför & Araç Kaydı</h4>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* RIGHT: Main Content Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.02] border border-white/10 rounded-[2rem] p-8 lg:p-12 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.4)] relative overflow-hidden">
              
              {/* Step 1: IMEI Search */}
              {step === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                    <Hash className="w-8 h-8 text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">Cihazın IMEI Numarası</h2>
                  <p className="text-slate-400 mb-8 leading-relaxed">Yeni takılan GT06N cihazının 15 haneli IMEI numarasını girerek TCP sunucumuzda konum atıp atmadığını kontrol edebilirsiniz.</p>
                  
                  <div className="relative max-w-md">
                    <input 
                      type="text" 
                      value={imei}
                      onChange={e => setImei(e.target.value)}
                      placeholder="861234567890123" 
                      className="w-full bg-black/50 border border-slate-700 focus:border-blue-500/50 rounded-2xl py-5 pl-6 pr-32 text-xl text-white placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-all font-mono tracking-widest shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                    />
                    <button 
                      onClick={handleSearch}
                      disabled={loading}
                      className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    >
                      {loading ? 'Aranıyor...' : 'Cihazı Bul'}
                    </button>
                  </div>
                  {error && <p className="text-red-400 mt-4 text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {error}</p>}
                </div>
              )}

              {/* Step 2: Location Verification */}
              {step === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                        <MapPin className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h2 className="text-3xl font-bold text-white mb-2">Konum Doğrulama</h2>
                      <p className="text-slate-400">Sistem cihazdan gelen sinyali yakaladı. Lütfen konumu teyit edin.</p>
                    </div>
                    <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-lg text-emerald-400 font-mono text-sm shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      SİNYAL ALINDI
                    </div>
                  </div>

                  <div className="my-8">
                    {location && <MiniMap lat={location.lat} lng={location.lng} imei={imei} />}
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setStep(1)} className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl transition-colors">
                      Geri Dön
                    </button>
                    <button onClick={handleConfirmLocation} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2">
                      <CheckCircle className="w-5 h-5"/> Konum Doğru, Kayda Geç
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Registration Form */}
              {step === 3 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                   <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 border border-purple-500/20">
                    <Car className="w-8 h-8 text-purple-400" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">Araç ve Şoför Bilgileri</h2>
                  <p className="text-slate-400 mb-8">Bu cihazı taşıyan aracın fiziksel bilgilerini sisteme tanımlayın.</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="md:col-span-2">
                      <InputField icon={Car} label="Araç Plakası" name="plate" placeholder="34 ABC 123" />
                    </div>
                    <InputField icon={Info} label="Araç Marka & Model" name="model" placeholder="Ford Transit" />
                    <InputField icon={Info} label="Araç Yılı" name="year" type="number" placeholder="2023" />
                    
                    <div className="col-span-full h-px bg-slate-800 my-2"></div>
                    
                    <InputField icon={User} label="Şoför Adı Soyadı" name="driver_name" placeholder="Ahmet Yılmaz" />
                    <InputField icon={Smartphone} label="Şoför Telefonu" name="driver_phone" placeholder="0555 123 45 67" />
                    
                    <div className="md:col-span-2">
                      <InputField icon={Smartphone} label="Cihaz İçindeki SIM Numarası" name="sim" placeholder="0555 987 65 43" />
                    </div>
                  </div>

                  {error && <p className="text-red-400 mb-6 text-sm font-medium">{error}</p>}

                  <div className="flex justify-between items-center">
                    <button onClick={() => setStep(2)} className="text-slate-400 hover:text-white transition-colors">
                      ← Geri
                    </button>
                    <button 
                      onClick={handleSave} 
                      disabled={loading}
                      className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_50px_rgba(37,99,235,0.6)] transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                      <ShieldCheck className="w-6 h-6"/> 
                      {loading ? 'KAYDEDİLİYOR...' : 'CİHAZI SİSTEME EKLE'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Success */}
              {step === 4 && (
                <div className="text-center py-12 animate-in zoom-in-95 duration-500">
                  <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
                    <CheckCircle className="w-16 h-16 text-emerald-400" />
                  </div>
                  <h2 className="text-5xl font-black text-white mb-4 tracking-tight">Kayıt Başarılı!</h2>
                  <p className="text-slate-400 text-lg mb-10">Cihaz sisteme eklendi ve filo ağına katıldı. Artık canlı haritadan takip edebilirsiniz.</p>
                  <button 
                    onClick={() => {
                      setStep(1); setImei(''); setLocation(null); setFormData({ plate: '', model: '', year: '', driver_name: '', driver_phone: '', sim: '' });
                    }} 
                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-colors border border-white/10"
                  >
                    Yeni Bir Cihaz Ekle
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
