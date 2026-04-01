'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Activity, LayoutDashboard, Users, FileText, ClipboardList, Phone, PlayCircle, Brain, BarChart3, Settings, ChevronLeft } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/closers', label: 'Closers', icon: Users },
  { href: '/eod-logs', label: 'EOD Logs', icon: FileText },
  { href: '/forms', label: 'Forms', icon: ClipboardList },
  { href: '/calls', label: 'Call Center', icon: Phone },
  { href: '/recordings', label: 'Recordings', icon: PlayCircle },
  { href: '/reports', label: 'AI Reports', icon: Brain },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`fixed top-0 left-0 h-screen bg-crm-surface border-r border-crm-border flex flex-col transition-all duration-300 z-50 ${collapsed ? 'w-[64px]' : 'w-[240px]'}`}>
      <div className="flex items-center gap-2 px-4 h-16 border-b border-crm-border">
        <Activity className="w-6 h-6 text-crm-accent flex-shrink-0" />
        {!collapsed && (
          <span className="font-display font-bold text-lg text-crm-text-bright">
            Summit<span className="text-crm-accent">CRM</span>
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2 space-y-1">
        <Link href="/settings" className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-crm-border text-crm-muted hover:text-crm-text transition-colors"
      >
        <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
      </button>
    </aside>
  );
}
