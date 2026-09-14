'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, LayoutDashboard, ClipboardList, Sparkles, Trophy, MoreHorizontal } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import RepAvatar from '@/components/RepAvatar';
import WorkspaceSwitcher from '@/components/WorkspaceSwitcher';
import { getUser } from '@/lib/auth';
import { useAccess } from '@/lib/workspace-client';
import useRoster from '@/lib/use-roster';

// The phone shell. Above 1024px none of this renders and the desktop layout is
// exactly what it always was; below it, the sidebar becomes a drawer over the
// content rather than a column beside it, and the five things a rep actually
// does between calls get a permanent bar at the bottom.

var TABS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/submit', label: 'Submit', icon: ClipboardList },
  { href: '/aios', label: 'AIOS', icon: Sparkles },
  { href: '/me', label: 'Awards', icon: Trophy },
];

// The page title in the top bar. Taken from the route rather than from each page,
// so a page does not have to know it is being rendered on a phone.
var TITLES = {
  '/': 'Dashboard', '/me': 'My Dashboard', '/submit': 'Submit reports',
  '/aios': 'Summit AIOS', '/leaderboard': 'Leaderboard', '/onboarding': 'Onboarding',
  '/booked-calls': 'Booked Calls', '/closed-deals': 'Closed Deals', '/skool': 'Skool',
  '/eod-logs': 'EOD Logs', '/after-call': 'After-Call', '/analytics': 'Analytics',
  '/commissions': 'Commissions', '/closers': 'Closers', '/message-log': 'Message Log',
  '/settings': 'Settings', '/operator': 'Operator View',
};

function titleFor(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.indexOf('/admin/workspace/forms') === 0) return 'Submit Forms';
  if (pathname.indexOf('/admin/workspace') === 0) return 'Access & Sign-ins';
  if (pathname.indexOf('/admin') === 0) return 'Admin';
  return 'Summit OS';
}

export default function MobileChrome({ children }) {
  var pathname = usePathname();
  var router = useRouter();
  var roster = useRoster();
  var access = useAccess();
  var s1 = useState(false), open = s1[0], setOpen = s1[1];
  var s2 = useState(null), user = s2[0], setUser = s2[1];
  var drawerRef = useRef(null);
  var burgerRef = useRef(null);
  var scrollY = useRef(0);
  var touchStart = useRef(null);

  useEffect(function() { setUser(getUser()); }, [pathname]);

  var close = useCallback(function() { setOpen(false); }, []);

  // Closes on navigation. Leaving it open over the page you just moved to is the
  // single most common drawer bug.
  useEffect(function() { setOpen(false); }, [pathname]);

  useEffect(function() {
    if (!open) return;

    // Lock the page behind the drawer. Deliberately not position:fixed on body —
    // on iOS that scrolls the page to the top and never puts it back.
    scrollY.current = window.scrollY;
    document.body.style.overflow = 'hidden';

    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !drawerRef.current) return;
      // Keep focus inside the drawer while it is over everything else.
      var focusable = drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    document.addEventListener('keydown', onKey);
    var firstLink = drawerRef.current && drawerRef.current.querySelector('a[href], button');
    if (firstLink) firstLink.focus();

    return function() {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      window.scrollTo(0, scrollY.current);
      // Back to the control that opened it, so a keyboard or screen-reader user
      // does not land at the top of the document.
      if (burgerRef.current) burgerRef.current.focus();
    };
  }, [open, close]);

  function onTouchStart(e) {
    touchStart.current = e.touches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchStart.current === null) return;
    var dx = e.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (dx < -50) close();
  }

  var canSwitch = !!(access && access.canSwitch);
  var moreActive = !TABS.some(function(t) { return t.href === pathname; });

  return (
    <>
      {/* ===== TOP BAR (phones and tablets only) ===== */}
      <header className="mob-topbar lg:hidden">
        <button
          ref={burgerRef}
          type="button"
          className="mob-burger"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={function() { setOpen(true); }}
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="mob-title">{titleFor(pathname)}</span>

        <div className="mob-topbar-right">
          {canSwitch ? (
            <div className="mob-ws"><WorkspaceSwitcher collapsed /></div>
          ) : user ? (
            <RepAvatar
              rep={roster.find(user.name) || roster.findByEmail(user.email)}
              name={user.name}
              size={30}
              style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-accent)' }}
            />
          ) : null}
        </div>
      </header>

      {/* ===== DRAWER ===== */}
      {/* One sidebar, not two. Above lg the same element is the static column it
          has always been; below it, CSS slides it in over the page. */}
      <div
        ref={drawerRef}
        className={'mob-drawer' + (open ? ' open' : '')}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-hidden={open ? undefined : 'true'}
      >
        <Sidebar />
      </div>

      {open ? (
        <div className="mob-scrim lg:hidden" onClick={close} aria-hidden="true" />
      ) : null}

      {/* ===== THE PAGE ===== */}
      <main className="mob-main lg:ml-[268px] transition-all duration-300">{children}</main>

      {/* ===== BOTTOM TABS ===== */}
      <nav className="mob-tabs lg:hidden" aria-label="Primary">
        {TABS.map(function(tab) {
          var active = pathname === tab.href;
          var Icon = tab.icon;
          return (
            <Link key={tab.href} href={tab.href} className={'mob-tab' + (active ? ' active' : '')}>
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={'mob-tab' + (moreActive ? ' active' : '')}
          onClick={function() { setOpen(true); }}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
