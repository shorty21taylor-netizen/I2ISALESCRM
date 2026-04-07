'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, LayoutDashboard, Users, FileText, ClipboardList, Phone, PlayCircle, Brain, BarChart3, Settings, ChevronLeft, UserPlus, LogOut, CreditCard, MessageSquare, Menu, X } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';

var navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/closers', label: 'Closers', icon: Users },
  { href: '/submit', label: 'Submit', icon: ClipboardList },
  { href: '/commissions', label: 'Commissions', icon: CreditCard },
  { href: '/eod-logs', label: 'EOD Logs', icon: FileText },
  { href: '/calls', label: 'Call Center', icon: Phone },
  { href: '/recordings', label: 'Recordings', icon: PlayCircle },
  { href: '/reports', label: 'AI Reports', icon: Brain },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
  var pathname = usePathname();
  var s1 = useState(false), collapsed = s1[0], setCollapsed = s1[1];
  var s2 = useState(null), user = s2[0], setUser = s2[1];
  var s3 = useState(false), mobileOpen = s3[0], setMobileOpen = s3[1];

  useEffect(function() {
    setUser(getUser());
  }, []);

  // Close mobile drawer on route change
  useEffect(function() {
    setMobileOpen(false);
  }, [pathname]);

  function handleSignOut() {
    logout();
    window.location.href = '/login';
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={function() { setMobileOpen(true); }}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass-card"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-crm-text-bright" />
      </button>

      {/* Backdrop for mobile drawer */}
      {mobileOpen && (
        <div
          onClick={function() { setMobileOpen(false); }}
          className="md:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm"
        />
      )}

      {/* Sidebar — desktop: sticky, mobile: slide-out drawer */}
      <aside className={
        'sidebar ' + (collapsed ? 'w-[64px]' : 'w-[240px]') +
        ' hidden md:flex md:flex-col'
      }>
        <div className="flex items-center gap-2 px-4 h-16 border-b border-crm-border/50">
          <div className="glow-red rounded-lg">
            <Activity className="w-6 h-6 text-crm-accent flex-shrink-0" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-lg text-crm-text-bright">
              Summit<span className="text-crm-accent">CRM</span>
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(function(item) {
            var isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={'nav-link ' + (isActive ? 'active' : '')}>
                <item.icon className="w-5 h-5 flex-shrink-0 nav-icon" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <hr className="divider mx-2" />

        <div className="px-2 py-2 space-y-1">
          {user && user.email === 'shorty21taylor@gmail.com' && (
            <>
              <Link href="/admin/invites" className={'nav-link ' + (pathname === '/admin/invites' ? 'active' : '')}>
                <UserPlus className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Invite Team</span>}
              </Link>
              <Link href="/message-scheduler" className={'nav-link ' + (pathname === '/message-scheduler' ? 'active' : '')}>
                <MessageSquare className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>Messages</span>}
              </Link>
            </>
          )}
          <Link href="/settings" className={'nav-link ' + (pathname === '/settings' ? 'active' : '')}>
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </Link>
          <button onClick={handleSignOut} className="nav-link w-full">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {!collapsed && user && (
          <div className="px-3 py-3 border-t border-crm-border/50">
            <div className="flex items-center gap-2">
              <div className="avatar avatar-sm bg-crm-accent/10 text-crm-accent">
                {user.name ? user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-crm-text-bright truncate">{user.name}</div>
                <div className="text-xs text-crm-muted truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={function() { setCollapsed(!collapsed); }}
          className="flex items-center justify-center h-10 border-t border-crm-border/50 text-crm-muted hover:text-crm-text transition-colors"
        >
          <ChevronLeft className={'w-4 h-4 transition-transform duration-300 ' + (collapsed ? 'rotate-180' : '')} />
        </button>
      </aside>

      {/* Mobile drawer */}
      <aside className={
        'sidebar w-[260px] flex flex-col md:hidden fixed top-0 left-0 z-[60] h-screen transition-transform duration-300 ' +
        (mobileOpen ? 'translate-x-0' : '-translate-x-full')
      }>
        {/* Close button */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-crm-border/50">
          <div className="flex items-center gap-2">
            <div className="glow-red rounded-lg">
              <Activity className="w-6 h-6 text-crm-accent flex-shrink-0" />
            </div>
            <span className="font-display font-bold text-lg text-crm-text-bright">
              Summit<span className="text-crm-accent">CRM</span>
            </span>
          </div>
          <button
            onClick={function() { setMobileOpen(false); }}
            className="p-2 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5 text-crm-muted" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(function(item) {
            var isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={function() { setMobileOpen(false); }} className={'nav-link ' + (isActive ? 'active' : '')}>
                <item.icon className="w-5 h-5 flex-shrink-0 nav-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <hr className="divider mx-2" />

        <div className="px-2 py-2 space-y-1">
          {user && user.email === 'shorty21taylor@gmail.com' && (
            <>
              <Link href="/admin/invites" onClick={function() { setMobileOpen(false); }} className={'nav-link ' + (pathname === '/admin/invites' ? 'active' : '')}>
                <UserPlus className="w-5 h-5 flex-shrink-0" />
                <span>Invite Team</span>
              </Link>
              <Link href="/message-scheduler" onClick={function() { setMobileOpen(false); }} className={'nav-link ' + (pathname === '/message-scheduler' ? 'active' : '')}>
                <MessageSquare className="w-5 h-5 flex-shrink-0" />
                <span>Messages</span>
              </Link>
            </>
          )}
          <Link href="/settings" onClick={function() { setMobileOpen(false); }} className={'nav-link ' + (pathname === '/settings' ? 'active' : '')}>
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span>Settings</span>
          </Link>
          <button onClick={handleSignOut} className="nav-link w-full">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>

        {user && (
          <div className="px-3 py-3 border-t border-crm-border/50">
            <div className="flex items-center gap-2">
              <div className="avatar avatar-sm bg-crm-accent/10 text-crm-accent">
                {user.name ? user.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase() : '?'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-crm-text-bright truncate">{user.name}</div>
                <div className="text-xs text-crm-muted truncate">{user.email}</div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
