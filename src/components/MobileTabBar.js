'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { LayoutDashboard, PlusSquare, Users, BarChart3, Menu } from 'lucide-react';
import MobileMoreSheet from './MobileMoreSheet';

export default function MobileTabBar() {
  var router = useRouter();
  var pathname = usePathname();
  var s = useState(false), moreOpen = s[0], setMoreOpen = s[1];

  var tabs = [
    { href: '/', label: 'Home', icon: LayoutDashboard, match: function(p) { return p === '/'; } },
    { href: '/submit', label: 'Submit', icon: PlusSquare, match: function(p) { return p.startsWith('/submit'); } },
    { href: '/closers', label: 'Closers', icon: Users, match: function(p) { return p.startsWith('/closers'); } },
    { href: '/reports', label: 'Reports', icon: BarChart3, match: function(p) { return p.startsWith('/reports') || p.startsWith('/analytics'); } },
  ];

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40" style={{
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <div className="flex items-stretch justify-around h-14">
          {tabs.map(function(tab) {
            var active = tab.match(pathname);
            var Icon = tab.icon;
            return (
              <button
                key={tab.href}
                onClick={function() { router.push(tab.href); }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
                style={{ color: active ? 'var(--crm-accent)' : 'var(--crm-text-muted)', minHeight: 'auto' }}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-display" style={{ fontWeight: active ? 700 : 500 }}>{tab.label}</span>
              </button>
            );
          })}
          <button
            onClick={function() { setMoreOpen(true); }}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            style={{ color: 'var(--crm-text-muted)', minHeight: 'auto' }}
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-display font-medium">More</span>
          </button>
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onClose={function() { setMoreOpen(false); }} />
    </>
  );
}
