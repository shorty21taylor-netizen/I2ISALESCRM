'use client';
import { useEffect } from 'react';
import MobileChrome from '@/components/MobileChrome';
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
    <div className="app-shell">
      <BrandTheme />
      {/* The shell owns the sidebar, the phone chrome and the main column. The
          268px left margin used to be unconditional, which made the document
          wider than a phone and slid every page sideways — it is a desktop-only
          rule now. */}
      <MobileChrome>{children}</MobileChrome>
    </div>
  );
}
