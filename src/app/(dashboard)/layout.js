'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { isLoggedIn } from '@/lib/auth';
import { getFormConfig } from '@/lib/form-config';

export default function DashboardLayout({ children }) {
  var router = useRouter();
  var s = useState(false), ready = s[0], setReady = s[1];
  useEffect(function() {
    if (!isLoggedIn()) { router.replace('/login'); return; }
    setReady(true);

    // Push WhatsApp config from localStorage to server-side store + scheduler
    var config = getFormConfig();
    if (config.assistroApiUrl || config.bookedCallGroupId || config.closedDealGroupId || config.eodReportGroupId || config.whatsappGroupId) {
      fetch('/api/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).catch(function() {});
    }
  }, [router]);
  if (!ready) return <div className="flex items-center justify-center min-h-screen bg-crm-bg"><div className="w-8 h-8 border-2 border-crm-accent border-t-transparent rounded-full animate-spin" /></div>;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-[240px] transition-all duration-300">{children}</main>
    </div>
  );
}
