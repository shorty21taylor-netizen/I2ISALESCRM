'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Phone } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import DateRangePicker from '@/components/DateRangePicker';
import RepAvatar from '@/components/RepAvatar';
import useRoster from '@/lib/use-roster';

// One dashboard, two roles. Closers and setters are measured on different
// funnels — a setter's day ends at the set, a closer's begins there — so the
// tiles and the columns differ, but both are read from /api/dashboard over the
// same range as the team dashboard. That is deliberate: these pages are a
// zoom on the team numbers, not a second opinion about them, and a figure here
// that disagreed with the same figure on the front page would be worse than no
// page at all.

function num(v) {
  return (v === null || v === undefined) ? '—' : Number(v).toLocaleString('en-US');
}

function money(v) {
  return (v === null || v === undefined) ? '—' : formatCurrency(v);
}

// A rate whose denominator was zero is unknowable, not zero.
function pct(v) {
  return (v === null || v === undefined) ? '—' : v + '%';
}

function Tiles({ title, note, tiles }) {
  return (
    <div className="td-section relative z-10">
      <div className="td-section-h">
        <h3 className="td-section-t">{title}</h3>
        {note ? <span className="section-tag">{note}</span> : null}
      </div>
      <div className="td-grid">
        {tiles.filter(Boolean).map(function(t) {
          return (
            <div key={t.label} className="td-tile">
              <p className="td-tile-l">{t.label}</p>
              <p className={'td-tile-v' + (t.tone ? ' ' + t.tone : '')}>{t.value}</p>
              {t.sub ? <p className="td-tile-s">{t.sub}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

var CLOSER_COLUMNS = [
  { key: 'name', label: 'Closer', text: true },
  { key: 'eodCount', label: 'EODs' },
  { key: 'dials', label: 'Dials' },
  { key: 'callsBooked', label: 'Booked' },
  { key: 'callsTaken', label: 'Taken' },
  { key: 'pitched', label: 'Pitched' },
  { key: 'noShows', label: 'No-show' },
  { key: 'closes', label: 'Closes' },
  { key: 'closeRate', label: 'Close %', rate: true },
  { key: 'cash', label: 'Cash', money: true },
  { key: 'revenue', label: 'Revenue', money: true },
  { key: 'cashPerCall', label: 'Cash / call', money: true },
];

var SETTER_COLUMNS = [
  { key: 'name', label: 'Setter', text: true },
  { key: 'daysReported', label: 'Days' },
  { key: 'dials', label: 'Dials' },
  { key: 'conversations', label: 'Convos' },
  { key: 'dialToConversation', label: 'Dial→Convo', rate: true },
  { key: 'liveCalls', label: 'Live' },
  { key: 'sets', label: 'Sets' },
  { key: 'conversationToSet', label: 'Convo→Set', rate: true },
  { key: 'followUps', label: 'Follow-ups' },
  { key: 'closes', label: 'Closed' },
  { key: 'setToClose', label: 'Set→Close', rate: true },
  { key: 'cash', label: 'Cash', money: true },
  { key: 'cashPerSet', label: 'Cash / set', money: true },
];

export default function RoleDashboard({ role }) {
  var isCloser = role === 'closer';
  var roster = useRoster();
  var workspaceId = useWorkspace();
  var router = useRouter();

  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState({ preset: 'today', start: '', end: '' }), range = s2[0], setRange = s2[1];
  var s3 = useState(true), loading = s3[0], setLoading = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState(isCloser ? 'cash' : 'cash'), sortKey = s5[0], setSortKey = s5[1];
  var s6 = useState('desc'), sortDir = s6[0], setSortDir = s6[1];

  var fetchIt = useCallback(function() {
    if (!workspaceId || !range.start || !range.end) return;
    apiFetch(withWorkspace('/api/dashboard?start=' + range.start + '&end=' + range.end, workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLoading(false);
        // The server refuses the team payload to reps and names where they belong.
        if (d && d.redirect) { router.replace(d.redirect); return; }
        if (!d || !d.success) { setError((d && d.error) || 'Could not load it.'); return; }
        setError('');
        setData(d);
      })
      .catch(function(e) { setLoading(false); setError(e.message || 'Could not load it.'); });
  }, [workspaceId, range.start, range.end, router]);

  useEffect(function() {
    fetchIt();
    var t = setInterval(fetchIt, 30000);
    return function() { clearInterval(t); };
  }, [fetchIt]);

  var metrics = (data && data.metrics) || {};
  var c = metrics.closers || {};
  var st = metrics.setters || {};

  // A closer row's close rate and cash-per-call are not on the payload; they are
  // the same two divisions the team tiles do, guarded the same way.
  var rows = (isCloser ? (data && data.closers) : (data && data.setters)) || [];
  rows = rows.filter(Boolean).map(function(r) {
    if (!isCloser) return r;
    var pitched = r.pitched || 0;
    var taken = r.callsTaken || 0;
    return Object.assign({}, r, {
      closeRate: pitched > 0 ? Math.round((r.closes / pitched) * 1000) / 10 : null,
      cashPerCall: taken > 0 ? Math.round((r.cash / taken) * 100) / 100 : null,
    });
  });

  var columns = isCloser ? CLOSER_COLUMNS : SETTER_COLUMNS;

  var sorted = rows.slice().sort(function(a, b) {
    var col = columns.filter(function(x) { return x.key === sortKey; })[0] || columns[0];
    var av = a[col.key], bv = b[col.key];
    if (col.text) {
      var cmp = String(av || '').localeCompare(String(bv || ''));
      return sortDir === 'asc' ? cmp : -cmp;
    }
    // A null rate sorts to the bottom in either direction — it is missing data,
    // not a low score, and floating it to the top of an ascending sort would
    // read as "these reps are the worst".
    var an = (av === null || av === undefined) ? null : Number(av);
    var bn = (bv === null || bv === undefined) ? null : Number(bv);
    if (an === null && bn === null) return 0;
    if (an === null) return 1;
    if (bn === null) return -1;
    return sortDir === 'asc' ? an - bn : bn - an;
  });

  function sortBy(key) {
    if (sortKey === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key);
    var col = columns.filter(function(x) { return x.key === key; })[0];
    setSortDir(col && col.text ? 'asc' : 'desc');
  }

  function cell(row, col) {
    var v = row[col.key];
    if (col.text) return v;
    if (col.money) return money(v);
    if (col.rate) return pct(v);
    return num(v);
  }

  // Totals over the rows on screen. Rates are deliberately absent: a column of
  // percentages does not have a meaningful sum, and averaging them would weight
  // a rep with two calls the same as one with forty.
  var totals = {};
  columns.forEach(function(col) {
    if (col.text || col.rate) return;
    totals[col.key] = sorted.reduce(function(s, r) { return s + (Number(r[col.key]) || 0); }, 0);
  });

  var closerTiles = [
    { label: 'Live calls taken', value: num(c.taken), sub: num(c.onCalendar) + ' on the calendar' },
    { label: 'Calls booked', value: num(c.sets) },
    { label: 'No shows', value: num(c.noShowed), sub: pct(c.showRate) + ' show rate', tone: 'warn' },
    { label: 'Calls pitched', value: num(c.pitched), sub: num(c.offeredNoClose) + ' offered, no close' },
    { label: 'Deals closed', value: num(c.closes), sub: pct(c.closeRate) + ' of offers' },
    { label: 'Cash collected', value: money(c.cashCollected), tone: 'good' },
    { label: 'Revenue', value: money(c.revenue), sub: 'reported on the day' },
    { label: 'Cash per call', value: money(c.cashPerCall), sub: money(c.cashPerOffer) + ' per offer' },
  ];

  var setterTiles = [
    { label: 'Outbound dials', value: num(st.dials) },
    { label: 'Conversations', value: num(st.conversations), sub: pct(st.dialToConversation) + ' of dials' },
    { label: 'Live calls', value: num(st.liveCalls) },
    {
      label: 'Total sets', value: num(st.sets),
      // Which source the headline took, said out loud — the two disagree often
      // and an operator chasing a number needs to know which one they are chasing.
      sub: (st.setsFromForms > st.setsReported
        ? num(st.setsFromForms) + ' on forms · ' + num(st.setsReported) + ' on EODs'
        : num(st.setsReported) + ' on EODs · ' + num(st.setsFromForms) + ' on forms'),
    },
    { label: 'Sets that showed', value: num(st.shows) },
    { label: 'No showed', value: num(st.noShowed), tone: 'warn' },
    { label: 'Sets closed', value: num(st.closed), sub: pct(st.setToClose) + ' of sets' },
    { label: 'Cash from sets', value: money(st.cash), tone: 'good' },
    { label: 'Follow-ups booked', value: num(st.followUps) },
  ];

  return (
    <div className="min-h-screen px-4 md:px-8 py-4 md:py-6 space-y-5">
      <header>
        <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
          {isCloser ? 'Closer Dashboard' : 'Setter Dashboard'}
        </h1>
        <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
          {isCloser
            ? 'Everything that happens once a call is on the calendar'
            : 'Everything that happens before the call is on the calendar'}
          {metrics.daysReported
            ? ' · ' + metrics.daysReported + ' reporting day' + (metrics.daysReported === 1 ? '' : 's')
            : ''}
        </p>
      </header>

      <DateRangePicker value={range} onChange={setRange} />

      {error ? (
        <div className="glass-card p-4">
          <p className="text-xs font-mono" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm font-mono py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading…</p>
      ) : (
        <>
          <Tiles
            title={isCloser ? 'Closer metrics' : 'Setter metrics'}
            note={isCloser
              ? (metrics.daysReported || 0) + ' reporting ' + ((metrics.daysReported === 1) ? 'day' : 'days')
              : (metrics.repsReporting || 0) + ' ' + ((metrics.repsReporting === 1) ? 'rep' : 'reps') + ' reporting'}
            tiles={isCloser ? closerTiles : setterTiles}
          />

          <div className="td-section relative z-10">
            <div className="td-section-h">
              <h3 className="td-section-t">
                {isCloser ? <Users className="w-4 h-4 inline mr-1.5" /> : <Phone className="w-4 h-4 inline mr-1.5" />}
                By {isCloser ? 'closer' : 'setter'}
              </h3>
              <span className="section-tag">{sorted.length} {sorted.length === 1 ? 'rep' : 'reps'}</span>
            </div>

            {sorted.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>
                  No {isCloser ? 'closer' : 'setter'} activity in this range.
                </p>
              </div>
            ) : (
              <div className="glass-card eodt-wrap">
                <table className="eodt">
                  <thead>
                    <tr>
                      {columns.map(function(col) {
                        return (
                          <th key={col.key} onClick={function() { sortBy(col.key); }}
                            className={sortKey === col.key ? 'eodt-sort' : ''}>
                            {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(function(row) {
                      return (
                        <tr key={row.name}>
                          {columns.map(function(col) {
                            return (
                              <td key={col.key}>
                                {col.text ? (
                                  <span className="inline-flex items-center gap-2">
                                    <RepAvatar rep={roster.find(row.name)} name={row.name} size={22} />
                                    {row.name}
                                  </span>
                                ) : cell(row, col)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      {columns.map(function(col, i) {
                        if (i === 0) return <td key={col.key}>Total</td>;
                        if (col.rate) return <td key={col.key}>—</td>;
                        return <td key={col.key}>{col.money ? money(totals[col.key]) : num(totals[col.key])}</td>;
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
