'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, LayoutDashboard, Users, FileText, ClipboardList, BarChart3, Settings, ChevronLeft, UserPlus, LogOut, CreditCard, MessageSquare, Building2, DollarSign, Trophy } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { useAccess } from '@/lib/workspace-client';

var navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/closers', label: 'Closers', icon: Users },
  { href: '/submit', label: 'Submit', icon: ClipboardList },
  { href: '/closed-deals', label: 'Closed Deals', icon: DollarSign },
  { href: '/commissions', label: 'Commissions', icon: CreditCard },
  { href: '/eod-logs', label: 'EOD Logs', icon: FileText },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/message-log', label: 'Message Log', icon: MessageSquare },
  { href: '/operator', label: 'Operator View', icon: Building2, operatorOnly: true },
];

var OPERATOR_EMAIL = 'shorty21taylor@gmail.com';

export default function Sidebar() {
  var pathname = usePathname();
  var s1 = useState(false), collapsed = s1[0], setCollapsed = s1[1];
  var s2 = useState(null), user = s2[0], setUser = s2[1];

  useEffect(function() {
    setUser(getUser());
  }, []);

  var access = useAccess();
  // Server is the authority on who is an owner; fall back to the known owner email
  // until it answers so the nav does not flicker.
  // Show the operator surfaces if EITHER the server confirms it or the signed-in
  // email is the operator's. Trusting the server alone meant one failed /auth/me
  // call — or an identity header that didn't arrive — silently hid the nav.
  // Visibility is permissive on purpose; the APIs still enforce access with a 403.
  var localOperator = !!(user && (user.email || '').toLowerCase() === OPERATOR_EMAIL);
  var isOwner = (access && access.isOwner) || localOperator;
  // A member belongs to exactly one workspace, so there is nothing to switch between.
  var canSwitch = access ? !!access.canSwitch : false;

  function handleSignOut() {
    logout();
    window.location.href = '/login';
  }

  return (
    <aside className={'sidebar ' + (collapsed ? 'w-[64px]' : 'w-[240px]')}>
      <div className="flex items-center gap-2 px-4 h-16 border-b border-crm-border/50">
        <div className="glow-accent rounded-lg">
          <Activity className="w-6 h-6 text-crm-accent flex-shrink-0" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-lg text-crm-text-bright">
            Summit<span className="text-crm-accent">CRM</span>
          </span>
        )}
      </div>

      {canSwitch && <WorkspaceSwitcher collapsed={collapsed} />}

      <nav className="flex-1 py-2 px-2 space-y-1 overflow-y-auto">
        {navItems.filter(function(item) {
          return !item.operatorOnly || isOwner;
        }).map(function(item) {
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
        {isOwner && (
          <>
            <Link href="/admin/workspaces" className={'nav-link ' + (pathname === '/admin/workspaces' ? 'active' : '')}>
              <Building2 className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Workspaces</span>}
            </Link>
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
  );
}
