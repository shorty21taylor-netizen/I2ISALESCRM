'use client';

import { useRouter } from 'next/navigation';
import { X, ClipboardList, DollarSign, Phone, Mic, BarChart, Settings, LogOut, MessageSquare, Sparkles } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';

export default function MobileMoreSheet(props) {
  var router = useRouter();
  var user = getUser();
  var isAdmin = user && user.email === 'shorty21taylor@gmail.com';

  if (!props.open) return null;

  function go(href) {
    router.push(href);
    props.onClose();
  }

  function signOut() {
    logout();
    router.push('/login');
  }

  var items = [
    { href: '/eod-logs', label: 'EOD Logs', icon: ClipboardList },
    { href: '/commissions', label: 'Commissions', icon: DollarSign },
    { href: '/calls', label: 'Call Center', icon: Phone },
    { href: '/recordings', label: 'Recordings', icon: Mic },
    { href: '/analytics', label: 'Analytics', icon: BarChart },
    { href: '/reports', label: 'AI Reports', icon: Sparkles },
  ];

  var adminItems = [
    { href: '/message-scheduler', label: 'Messages', icon: MessageSquare },
  ];

  return (
    <div className="md:hidden fixed inset-0 z-50">
      <div
        onClick={props.onClose}
        className="absolute inset-0 animate-fadein"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      />

      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden animate-slideup"
        style={{
          background: 'rgba(15,15,15,0.96)',
          backdropFilter: 'saturate(180%) blur(30px)',
          WebkitBackdropFilter: 'saturate(180%) blur(30px)',
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          maxHeight: '85vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>More</h3>
          <button onClick={props.onClose} className="p-2 -mr-2 active:scale-90 transition-transform" style={{ minHeight: 'auto' }}>
            <X className="w-5 h-5" style={{ color: 'var(--crm-text-muted)' }} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 60px)' }}>
          <div className="px-3 pb-2">
            {items.map(function(item) {
              var Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={function() { go(item.href); }}
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl active:bg-white/5 active:scale-[0.98] transition-all"
                  style={{ minHeight: 'auto' }}
                >
                  <div className="p-2 rounded-lg" style={{ background: 'var(--glass-surface-hover)' }}>
                    <Icon className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} />
                  </div>
                  <span className="text-sm font-display font-medium flex-1 text-left" style={{ color: 'var(--crm-text-bright)' }}>{item.label}</span>
                </button>
              );
            })}
          </div>

          {isAdmin && (
            <>
              <div className="px-5 pt-3 pb-1">
                <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--crm-text-muted)' }}>Admin</p>
              </div>
              <div className="px-3 pb-2">
                {adminItems.map(function(item) {
                  var Icon = item.icon;
                  return (
                    <button
                      key={item.href}
                      onClick={function() { go(item.href); }}
                      className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl active:bg-white/5 active:scale-[0.98] transition-all"
                      style={{ minHeight: 'auto' }}
                    >
                      <div className="p-2 rounded-lg" style={{ background: 'var(--glass-surface-hover)' }}>
                        <Icon className="w-4 h-4" style={{ color: 'var(--crm-accent)' }} />
                      </div>
                      <span className="text-sm font-display font-medium flex-1 text-left" style={{ color: 'var(--crm-text-bright)' }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="px-3 pb-2 mt-2 pt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={function() { go('/settings'); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl active:bg-white/5 active:scale-[0.98] transition-all"
              style={{ minHeight: 'auto' }}
            >
              <div className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Settings className="w-4 h-4" style={{ color: 'var(--crm-text-muted)' }} />
              </div>
              <span className="text-sm font-display font-medium flex-1 text-left" style={{ color: 'var(--crm-text-bright)' }}>Settings</span>
            </button>

            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl active:bg-white/5 active:scale-[0.98] transition-all"
              style={{ minHeight: 'auto' }}
            >
              <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <LogOut className="w-4 h-4" style={{ color: 'var(--crm-negative)' }} />
              </div>
              <span className="text-sm font-display font-medium flex-1 text-left" style={{ color: 'var(--crm-negative)' }}>Sign Out</span>
            </button>
          </div>

          {user && (
            <div className="px-5 py-4 mt-2" style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{user.name}</p>
              <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{user.email}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
