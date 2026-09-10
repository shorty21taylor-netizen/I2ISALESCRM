'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, LayoutDashboard, UserCircle, Users, FileText, ClipboardList, BarChart3, Settings, ChevronLeft, ChevronDown, UserPlus, LogOut, CreditCard, MessageSquare, Building2, DollarSign, Trophy, Phone, PhoneCall, GraduationCap } from 'lucide-react';
import { getUser, logout } from '@/lib/auth';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { useAccess } from '@/lib/workspace-client';
import RepAvatar from '@/components/RepAvatar';
import useRoster from '@/lib/use-roster';

// The menu is grouped by what someone is trying to do, not by what the data is
// called. A section opens on its own when the page you are on lives inside it, so
// nobody has to remember which folder holds which page.
var navGroups = [
  {
    id: 'mine',
    label: 'My Work',
    icon: UserCircle,
    items: [
      { href: '/me', label: 'My Dashboard', icon: UserCircle },
      { href: '/submit', label: 'Submit a Form', icon: ClipboardList },
      { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: Phone,
    items: [
      { href: '/booked-calls', label: 'Booked Calls', icon: Phone },
      { href: '/closed-deals', label: 'Closed Deals', icon: DollarSign },
      { href: '/skool', label: 'Skool Community', icon: GraduationCap },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    icon: FileText,
    items: [
      { href: '/eod-logs', label: 'EOD Logs', icon: FileText },
      { href: '/after-call', label: 'After-Call', icon: PhoneCall },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/commissions', label: 'Commissions', icon: CreditCard },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    teamOnly: true,
    items: [
      { href: '/', label: 'Team Dashboard', icon: LayoutDashboard, teamOnly: true },
      { href: '/closers', label: 'Closers', icon: Users, teamOnly: true },
      { href: '/message-log', label: 'Message Log', icon: MessageSquare, teamOnly: true },
      { href: '/operator', label: 'Operator View', icon: Building2, operatorOnly: true },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Building2,
    operatorOnly: true,
    items: [
      { href: '/admin/workspaces', label: 'Workspaces', icon: Building2, operatorOnly: true },
      { href: '/admin/invites', label: 'Team & Permissions', icon: UserPlus, operatorOnly: true },
      { href: '/message-scheduler', label: 'Messages', icon: MessageSquare, operatorOnly: true },
    ],
  },
];

var OPEN_KEY = 'summit-crm-nav-open';

var OPERATOR_EMAIL = 'shorty21taylor@gmail.com';

export default function Sidebar() {
  var roster = useRoster();
  var pathname = usePathname();
  var s1 = useState(false), collapsed = s1[0], setCollapsed = s1[1];
  var s2 = useState(null), user = s2[0], setUser = s2[1];
  var s3 = useState(null), openGroups = s3[0], setOpenGroups = s3[1];

  useEffect(function() {
    setUser(getUser());
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null'); } catch (e) { saved = null; }
    // First run opens everything, so nobody meets an empty menu and has to
    // discover that the sections unfold.
    setOpenGroups(saved || navGroups.reduce(function(acc, g) { acc[g.id] = true; return acc; }, {}));
  }, []);

  function toggleGroup(id) {
    var next = Object.assign({}, openGroups);
    next[id] = !next[id];
    setOpenGroups(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch (e) { /* private mode */ }
  }

  var access = useAccess();
  // Server is the authority on who is an owner; fall back to the known owner email
  // until it answers so the nav does not flicker.
  // Show the operator surfaces if EITHER the server confirms it or the signed-in
  // email is the operator's. Trusting the server alone meant one failed /auth/me
  // call — or an identity header that didn't arrive — silently hid the nav.
  // Visibility is permissive on purpose; the APIs still enforce access with a 403.
  var localOperator = !!(user && (user.email || '').toLowerCase() === OPERATOR_EMAIL);
  var isOwner = (access && access.isOwner) || localOperator;
  // Same permissive rule as isOwner: assume a manager until the server says
  // otherwise, so a slow /auth/me never hides the nav from someone entitled to it.
  // The APIs are the enforcement point; this only decides what is worth showing.
  var canSeeTeam = access ? (!!access.canSeeTeam || isOwner) : true;
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
            Summit<span className="text-crm-accent">OS</span>
          </span>
        )}
      </div>

      {canSwitch && <WorkspaceSwitcher collapsed={collapsed} />}

      <nav className="nav-scroll flex-1 min-h-0 py-2 px-2 overflow-y-auto">
        {navGroups.map(function(group) {
          if (group.operatorOnly && !isOwner) return null;
          if (group.teamOnly && !canSeeTeam) return null;

          var items = group.items.filter(function(item) {
            if (item.operatorOnly && !isOwner) return false;
            if (item.teamOnly && !canSeeTeam) return false;
            return true;
          });
          if (!items.length) return null;

          var holdsCurrentPage = items.some(function(item) { return pathname === item.href; });
          // A collapsed rail has no room for section headers, so it shows every
          // link flat; the page you are on always stays reachable.
          var open = collapsed || holdsCurrentPage || (openGroups ? openGroups[group.id] !== false : true);

          return (
            <div key={group.id} className="nav-group">
              {!collapsed && (
                <button
                  type="button"
                  className={'nav-group-head' + (open ? ' open' : '') + (holdsCurrentPage ? ' current' : '')}
                  onClick={function() { toggleGroup(group.id); }}
                  aria-expanded={open}
                >
                  <group.icon className="w-4 h-4 flex-shrink-0 nav-group-icon" />
                  <span>{group.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 nav-group-chev" />
                </button>
              )}
              {open && (
                <div className="nav-group-items">
                  {items.map(function(item) {
                    var isActive = pathname === item.href;
                    return (
                      <Link key={item.href} href={item.href} className={'nav-link ' + (isActive ? 'active' : '')}>
                        <item.icon className="w-5 h-5 flex-shrink-0 nav-icon" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <hr className="divider my-2" />

        <Link href="/settings" className={'nav-link ' + (pathname === '/settings' ? 'active' : '')}>
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button onClick={handleSignOut} className="nav-link w-full">
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </nav>

      {!collapsed && user && (
        <div className="px-3 py-3 border-t border-crm-border/50">
          <div className="flex items-center gap-2">
            <RepAvatar
              rep={roster.find(user.name) || roster.findByEmail(user.email)}
              name={user.name}
              size={28}
              showStatus
              style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-accent)' }}
            />
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
