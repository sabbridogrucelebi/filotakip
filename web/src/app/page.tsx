"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, MapPin, Activity, ShieldCheck, BarChart3 } from 'lucide-react';
import EarthScene from '../components/EarthScene';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });
      const data = await res.json();
      
      if (res.ok && data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Giriş başarısız');
      }
    } catch (err) {
      setError('Sunucu bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#02040a] flex items-center justify-center relative overflow-hidden text-white">
      
      {/* FULL BACKGROUND 3D SCENE */}
      <EarthScene />

      {/* OVERLAY GRADIENTS FOR DEPTH */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-transparent to-[#02040a]/90 z-10"></div>
      
      {/* FLOATING BRANDING (Left side of the screen) */}
      <div className="absolute top-12 left-12 z-20 pointer-events-none hidden lg:block">
        <h2 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white to-blue-400 mb-4 drop-shadow-2xl">
          Filo Yönetim<br/>Merkezi
        </h2>
        <p className="text-blue-200/80 text-xl font-light tracking-wide max-w-md">
          Yapay zeka destekli, global ölçekli gerçek zamanlı araç takip ve telemetri platformu.
        </p>

        <div className="mt-12 flex gap-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5 text-blue-400" />
              <p className="text-white/60 text-xs uppercase tracking-widest font-bold">Aktif Araçlar</p>
            </div>
            <p className="text-white text-4xl font-black">174</p>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 px-8 py-5 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 mb-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <p className="text-white/60 text-xs uppercase tracking-widest font-bold">Ağ Durumu</p>
            </div>
            <p className="text-green-400 text-4xl font-black">%99.9</p>
          </div>
        </div>
      </div>

      {/* FLOATING LOGIN PANEL (Right side of the screen) */}
      <div className="absolute right-0 top-0 bottom-0 w-full lg:w-[500px] xl:w-[600px] z-20 flex flex-col justify-center p-8 sm:p-12">
        <div className="w-full relative">
          
          {/* Neon Glow Container */}
          <div className="relative p-[1px] rounded-[2.5rem] bg-gradient-to-br from-blue-500/40 via-transparent to-purple-500/40 shadow-[0_0_100px_rgba(59,130,246,0.2)]">
            
            {/* Glassmorphism Card */}
            <div className="relative bg-[#02040a]/70 backdrop-blur-[40px] p-10 sm:p-12 rounded-[2.5rem] overflow-hidden">
              
              {/* Inner top highlight & animated neon line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80"></div>
              
              <div className="mb-10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.6)] border border-blue-400/30">
                    <MapPin className="text-white w-7 h-7" />
                  </div>
                  <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 tracking-tight">Filo Takip</h1>
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">Sisteme Giriş</h2>
                <p className="text-blue-200/60 font-light text-sm">Yönetim paneline erişmek için bilgilerinizi girin.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-blue-400 uppercase tracking-widest ml-1">E-Posta Adresi</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="email"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-blue-500 focus:bg-blue-500/10 focus:shadow-[0_0_25px_rgba(59,130,246,0.3)] transition-all placeholder:text-slate-600 font-light"
                      placeholder="ornek@sirket.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-blue-400 uppercase tracking-widest">Şifre</label>
                    <a href="#" className="text-xs text-blue-400 hover:text-blue-300 hover:drop-shadow-[0_0_8px_rgba(96,165,250,0.8)] transition-all">Şifremi unuttum</a>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/10 rounded-2xl text-white focus:outline-none focus:border-purple-500 focus:bg-purple-500/10 focus:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all placeholder:text-slate-600 font-light tracking-widest"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-medium flex items-center gap-2">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 hover:from-blue-500 hover:via-indigo-400 hover:to-purple-500 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 mt-8 shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:shadow-[0_0_60px_rgba(168,85,247,0.8)] disabled:opacity-50"
                >
                  {loading ? 'Giriş yapılıyor...' : 'Oturum Aç'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>

              <div className="mt-10 flex items-center justify-center gap-6 text-slate-500 text-xs font-light">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-500/50" /> 256-bit Şifreleme</span>
                <span className="flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-purple-500/50" /> Kesintisiz Veri</span>
              </div>

              {/* Mobile App Downloads */}
              <div className="mt-10 pt-8 border-t border-white/5">
                <p className="text-center text-[10px] text-slate-500 mb-4 uppercase tracking-[0.2em] font-semibold">Mobil Uygulamalarımızı İndirin</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  
                  {/* App Store Button */}
                  <button className="flex items-center justify-center sm:justify-start gap-3 px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] group">
                    <svg className="w-7 h-7 text-white group-hover:text-blue-400 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.04 2.26-.79 3.59-.76 1.56.04 2.87.66 3.65 1.76-3.08 1.83-2.6 5.86.37 7.04-.76 1.76-1.57 3.25-2.69 4.13zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.39-1.92 4.38-3.74 4.25z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[9px] text-slate-400 leading-none group-hover:text-blue-200 transition-colors">Download on the</div>
                      <div className="text-sm font-semibold leading-tight text-white">App Store</div>
                    </div>
                  </button>
                  
                  {/* Google Play Button */}
                  <button className="flex items-center justify-center sm:justify-start gap-3 px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 rounded-xl transition-all shadow-[0_0_15px_rgba(255,255,255,0.02)] hover:shadow-[0_0_25px_rgba(168,85,247,0.15)] group">
                    <svg className="w-6 h-6 text-white group-hover:text-purple-400 transition-colors" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.562 21.438L16.275 14.1l-3.32-3.319-9.393 10.657zm17.382-8.528l-3.535-2.008-2.68 2.68 2.684 2.685 3.53-2.007c.883-.502.883-1.848 0-2.35zM3.562 2.562L12.955 13.22l3.32-3.32L3.562 2.562z"/>
                    </svg>
                    <div className="text-left">
                      <div className="text-[9px] text-slate-400 leading-none group-hover:text-purple-200 transition-colors">GET IT ON</div>
                      <div className="text-sm font-semibold leading-tight text-white">Google Play</div>
                    </div>
                  </button>

                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
