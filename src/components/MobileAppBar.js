'use client';

import { usePathname } from 'next/navigation';

var titles = {
  '/': 'Dashboard',
  '/submit': 'Submit',
  '/closers': 'Closers',
  '/commissions': 'Commissions',
  '/eod-logs': 'EOD Logs',
  '/calls': 'Call Center',
  '/recordings': 'Recordings',
  '/analytics': 'Analytics',
  '/reports': 'AI Reports',
  '/settings': 'Settings',
  '/message-scheduler': 'Messages',
};

export default function MobileAppBar() {
  var pathname = usePathname();
  var title = titles[pathname] || 'Summit';

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-30" style={{
      background: 'rgba(10,10,10,0.85)',
      backdropFilter: 'saturate(180%) blur(20px)',
      WebkitBackdropFilter: 'saturate(180%) blur(20px)',
      borderBottom: '0.5px solid rgba(255,255,255,0.06)',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      <div className="flex items-center justify-center h-12 px-4">
        <h1 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{title}</h1>
      </div>
    </header>
  );
}
