'use client';

import { useState, useEffect } from 'react';
import { Phone, DollarSign, FileText, PhoneCall } from 'lucide-react';
import BookedCallsPage from '@/components/records/BookedCalls';
import ClosedDealsPage from '@/components/records/ClosedDeals';
import EodLogsPage from '@/components/records/EodLogs';
import AfterCallPage from '@/components/records/AfterCall';

// The four record books on one page.
//
// They were four sidebar entries and four round trips to compare a booking
// against the EOD that reported it. Tabs rather than a merged table: each of
// these is a different record with a different shape, and flattening them into
// one grid would lose the columns that make each one worth reading. The pages
// themselves are unchanged and still own their own filters, so nothing that
// worked before stops working.
//
// Analytics deliberately stays its own page. It is a different job — reading
// trends, not looking a record up — and it belongs beside these rather than
// inside them.

var TABS = [
  { id: 'booked-calls', label: 'Booked Calls', icon: Phone, Page: BookedCallsPage },
  { id: 'closed-deals', label: 'Closed Deals', icon: DollarSign, Page: ClosedDealsPage },
  { id: 'eod-logs', label: 'EOD Logs', icon: FileText, Page: EodLogsPage },
  { id: 'after-call', label: 'After-Call', icon: PhoneCall, Page: AfterCallPage },
];

var TAB_KEY = 'summit-crm-records-tab';

export default function RecordsPage() {
  var s1 = useState(null), tab = s1[0], setTab = s1[1];

  // The tab is resolved on the client: ?tab= wins, then whatever was open last,
  // then the first one. Reading localStorage during render would not match what
  // the server rendered, so it happens after mount.
  useEffect(function() {
    var wanted = '';
    try {
      wanted = new URLSearchParams(window.location.search).get('tab') || '';
      if (!wanted) wanted = localStorage.getItem(TAB_KEY) || '';
    } catch (e) { wanted = ''; }
    var found = TABS.filter(function(t) { return t.id === wanted; })[0];
    setTab(found ? found.id : TABS[0].id);
  }, []);

  function choose(id) {
    setTab(id);
    try { localStorage.setItem(TAB_KEY, id); } catch (e) { /* private mode */ }
    // The address bar follows the tab, so a link to one of these still points at
    // the record somebody meant to share.
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', id);
      window.history.replaceState({}, '', url);
    } catch (e) { /* nothing worth breaking a page over */ }
  }

  var active = TABS.filter(function(t) { return t.id === tab; })[0];

  return (
    <div className="min-h-screen">
      <div className="px-4 md:px-8 pt-4 md:pt-6">
        <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5 flex-wrap">
          {TABS.map(function(t) {
            var Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={function() { choose(t.id); }}
                className={tab === t.id
                  ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                  : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200'}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mounted one at a time on purpose. All four together would fire four
          fetches and four polls on every visit to look at one of them. */}
      {active ? <active.Page /> : null}
    </div>
  );
}
