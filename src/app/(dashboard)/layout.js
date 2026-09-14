'use client';
import { useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import BrandTheme from '@/components/BrandTheme';
import { getFormConfig } from '@/lib/form-config';

// No door of its own. AuthGate wraps every non-public path and asks the server
// whether the session is still good; this used to re-check localStorage on top of
// it, which is a weaker test of a different thing — it bounced anyone holding a
// valid session cookie but an empty tab, which is exactly what a rep choosing
// between two workspaces has.
export default function DashboardLayout({ children }) {
  useEffect(function() {
    // Push WhatsApp config from localStorage to server-side store + scheduler
    var config = getFormConfig();
    if (config.assistroApiUrl || config.bookedCallGroupId || config.closedDealGroupId || config.eodReportGroupId || config.whatsappGroupId) {
      fetch('/api/whatsapp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).catch(function() {});
    }
  }, []);
  return (
    <div className="flex min-h-screen">
      <BrandTheme />
      <Sidebar />
      <main className="flex-1 ml-[268px] transition-all duration-300">{children}</main>
    </div>
  );
}
