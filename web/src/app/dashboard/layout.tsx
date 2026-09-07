import React from 'react';
import Sidebar from '@/components/dashboard/Sidebar';

export const metadata = {
  title: 'Dashboard - Filo Takip',
  description: 'Filo Takip Yönetim Paneli',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-[#02040a] overflow-hidden text-slate-200 font-sans">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 relative h-full">
        {children}
      </main>
    </div>
  );
}
