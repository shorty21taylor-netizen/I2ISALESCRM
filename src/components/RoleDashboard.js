'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';
import DateRangePicker from '@/components/DateRangePicker';
import RepAvatar from '@/components/RepAvatar';
import useRoster from '@/lib/use-roster';

// One dashboard, three roles. Closers, phone setters and DM setters are measured
// on different funnels — a setter's day ends at the set, a closer's begins there,
// a DM setter's starts at a lead in the inbox — so the tiles and the columns
// differ. Everything else is the same page, because three boards that drifted
// apart visually made the same numbers look like different kinds of fact.
//
// They are a zoom on the team numbers, not a second opinion about them: a figure
// here that disagreed with the same figure on the front page would be worse than
// no page at all.

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

var DM_COLUMNS = [
  { key: 'name', label: 'DM Setter', text: true },
  { key: 'daysReported', label: 'Days' },
  { key: 'newLeads', label: 'New leads' },
  { key: 'conversations', label: 'Convos' },
  { key: 'leadToConversation', label: 'Lead→Convo', rate: true },
  { key: 'booked', label: 'Booked' },
  { key: 'conversationToBooked', label: 'Convo→Booked', rate: true },
  { key: 'showed', label: 'Showed' },
  { key: 'showRate', label: 'Show %', rate: true },
  { key: 'closes', label: 'Closed' },
  { key: 'showToClose', label: 'Show→Close', rate: true },
  { key: 'ghosted', label: 'Ghosted' },
  { key: 'reactivated', label: 'Reactivated' },
  { key: 'cash', label: 'Cash', money: true },
];

// Everything that differs between the three boards, in one place. Anything not
// in here is shared by construction, which is the point: the layout, the hero
// band, the table, the sorting, the totals and the empty states cannot drift.
var ROLES = {
  closer: {
    title: 'Closer Dashboard',
    blurb: 'Everything that happens once a call is on the calendar',
    endpoint: '/api/dashboard',
    columns: CLOSER_COLUMNS,
    noun: 'closer',
    sectionTitle: 'Closer metrics',
    empty: 'No closer activity in this range.',
  },
  setter: {
    title: 'Setter Dashboard',
    blurb: 'Everything that happens before the call is on the calendar',
    endpoint: '/api/dashboard',
    columns: SETTER_COLUMNS,
    noun: 'setter',
    sectionTitle: 'Setter metrics',
    empty: 'No setter activity in this range.',
  },
  'dm-setter': {
    title: 'DM Setter Dashboard',
    blurb: 'The inbox funnel — new leads through to the cash their booked calls collected',
    endpoint: '/api/dm-setters',
    columns: DM_COLUMNS,
    noun: 'DM setter',
    sectionTitle: 'DM metrics',
    empty: 'No DM setter reports in this range.',
    emptyHint: 'A report lands here when its Position says DM Setter.',
  },
};

export default function RoleDashboard({ role }) {
  var cfg = ROLES[role] || ROLES.closer;
  var isCloser = role === 'closer';
  var isDm = role === 'dm-setter';
  var roster = useRoster();
  var workspaceId = useWorkspace();
  var router = useRouter();

  var s1 = useState(null), data = s1[0], setData = s1[1];
  var s2 = useState({ preset: 'today', start: '', end: '' }), range = s2[0], setRange = s2[1];
  var s3 = useState(true), loading = s3[0], setLoading = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState('cash'), sortKey = s5[0], setSortKey = s5[1];
  var s6 = useState('desc'), sortDir = s6[0], setSortDir = s6[1];
  var s7 = useState(null), openNotes = s7[0], setOpenNotes = s7[1];

  var fetchIt = useCallback(function() {
    if (!workspaceId || !range.start || !range.end) return;
    var url = cfg.endpoint + '?start=' + range.start + '&end=' + range.end;
    apiFetch(withWorkspace(url, workspaceId))
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
  }, [workspaceId, range.start, range.end, router, cfg.endpoint]);

  useEffect(function() {
    fetchIt();
    var t = setInterval(fetchIt, 30000);
    return function() { clearInterval(t); };
  }, [fetchIt]);

  // ---- the two payload shapes, flattened to one ----
  // /api/dashboard hands back metrics + per-rep arrays; /api/dm-setters hands
  // back a board with the totals and rates split apart. Both end up as a flat
  // object per rep and a flat object for the team, so everything below this
  // point is identical for all three roles.
  var board = (data && data.board) || null;
  var metrics = (data && data.metrics) || {};
  var team = isDm
    ? Object.assign({}, (board && board.team && board.team.totals) || {},
                        (board && board.team && board.team.rates) || {})
    : (isCloser ? (metrics.closers || {}) : (metrics.setters || {}));

  var rows;
  if (isDm) {
    rows = ((board && board.reps) || []).map(function(row) {
      return Object.assign({
        name: row.name, daysReported: row.daysReported,
        themes: row.themes, bottlenecks: row.bottlenecks,
      }, row.totals, row.rates);
    });
  } else {
    rows = ((isCloser ? (data && data.closers) : (data && data.setters)) || []).filter(Boolean);
    if (isCloser) {
      // A closer row's close rate and cash-per-call are not on the payload; they
      // are the same two divisions the team tiles do, guarded the same way.
      rows = rows.map(function(r) {
        var pitched = r.pitched || 0;
        var taken = r.callsTaken || 0;
        return Object.assign({}, r, {
          closeRate: pitched > 0 ? Math.round((r.closes / pitched) * 1000) / 10 : null,
          cashPerCall: taken > 0 ? Math.round((r.cash / taken) * 100) / 100 : null,
        });
      });
    }
  }

  var daysReported = isDm ? (board && board.daysReported) : metrics.daysReported;
  var repsReporting = isDm
    ? ((board && board.repCount) || 0)
    : (isCloser ? (metrics.daysReported || 0) : (metrics.repsReporting || 0));

  var columns = cfg.columns;

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

  // ---- the hero band: every board leads with the money, then two figures that
  // say what produced it on that role's own funnel ----
  var hero = isCloser ? {
    figure: money(team.cashCollected),
    sub: num(team.closes) + ' close' + (team.closes === 1 ? '' : 's') + ' · ' + pct(team.closeRate) + ' of offers',
    side: [
      { label: 'Calls taken', value: num(team.taken), note: num(team.onCalendar) + ' on the calendar' },
      { label: 'Cash per call', value: money(team.cashPerCall), note: money(team.cashPerOffer) + ' per offer' },
    ],
  } : isDm ? {
    figure: money(team.cash),
    sub: num(team.closes) + ' close' + (team.closes === 1 ? '' : 's') + ' · ' + pct(team.showToClose) + ' of those that showed',
    side: [
      { label: 'New leads', value: num(team.newLeads), note: pct(team.leadToConversation) + ' into a conversation' },
      { label: 'Calls booked', value: num(team.booked), note: pct(team.showRate) + ' show rate' },
    ],
  } : {
    figure: money(team.cash),
    sub: num(team.sets) + ' set' + (team.sets === 1 ? '' : 's') + ' · ' + pct(team.setToClose) + ' closed',
    side: [
      { label: 'Outbound dials', value: num(team.dials), note: pct(team.dialToConversation) + ' into a conversation' },
      { label: 'Conversations', value: num(team.conversations), note: pct(team.conversationToSet) + ' became a set' },
    ],
  };

  var closerTiles = [
    { label: 'Live calls taken', value: num(team.taken), sub: num(team.onCalendar) + ' on the calendar' },
    { label: 'Calls booked', value: num(team.sets) },
    { label: 'No shows', value: num(team.noShowed), sub: pct(team.showRate) + ' show rate', tone: 'warn' },
    { label: 'Calls pitched', value: num(team.pitched), sub: num(team.offeredNoClose) + ' offered, no close' },
    { label: 'Deals closed', value: num(team.closes), sub: pct(team.closeRate) + ' of offers' },
    { label: 'Cash collected', value: money(team.cashCollected), tone: 'good' },
    { label: 'Revenue', value: money(team.revenue), sub: 'reported on the day' },
    { label: 'Cash per call', value: money(team.cashPerCall), sub: money(team.cashPerOffer) + ' per offer' },
  ];

  var setterTiles = [
    { label: 'Outbound dials', value: num(team.dials) },
    { label: 'Conversations', value: num(team.conversations), sub: pct(team.dialToConversation) + ' of dials' },
    { label: 'Live calls', value: num(team.liveCalls) },
    {
      label: 'Total sets', value: num(team.sets),
      // Which source the headline took, said out loud — the two disagree often
      // and an operator chasing a number needs to know which one they are chasing.
      sub: (team.setsFromForms > team.setsReported
        ? num(team.setsFromForms) + ' on forms · ' + num(team.setsReported) + ' on EODs'
        : num(team.setsReported) + ' on EODs · ' + num(team.setsFromForms) + ' on forms'),
    },
    { label: 'Sets that showed', value: num(team.shows) },
    { label: 'No showed', value: num(team.noShowed), tone: 'warn' },
    { label: 'Sets closed', value: num(team.closed), sub: pct(team.setToClose) + ' of sets' },
    { label: 'Cash from sets', value: money(team.cash), tone: 'good' },
    { label: 'Follow-ups booked', value: num(team.followUps) },
  ];

  var dmTiles = [
    { label: 'New leads', value: num(team.newLeads) },
    { label: 'Conversations', value: num(team.conversations), sub: pct(team.leadToConversation) + ' of leads' },
    { label: 'Calls booked', value: num(team.booked), sub: pct(team.conversationToBooked) + ' of conversations' },
    { label: 'Showed', value: num(team.showed), sub: pct(team.showRate) + ' show rate' },
    { label: 'Deals closed', value: num(team.closes), sub: pct(team.showToClose) + ' of those that showed' },
    { label: 'Cash collected', value: money(team.cash), tone: 'good' },
    { label: 'Cash per lead', value: money(team.cashPerLead), sub: money(team.avgDealSize) + ' average deal' },
    { label: 'Went ghost', value: num(team.ghosted), sub: pct(team.ghostRate) + ' of conversations', tone: 'warn' },
    { label: 'Reactivated', value: num(team.reactivated), sub: 'dead leads brought back' },
  ];

  var tiles = isCloser ? closerTiles : (isDm ? dmTiles : setterTiles);
  var hasData = isDm ? !!board : !!data;

  return (
    <div className="min-h-screen px-4 md:px-8 py-4 md:py-6 space-y-5">
      <header>
        <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>
          {cfg.title}
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--crm-text-muted)' }}>
          {cfg.blurb}
          {daysReported
            ? ' · ' + daysReported + ' reporting day' + (daysReported === 1 ? '' : 's')
            : ''}
        </p>
      </header>

      <DateRangePicker value={range} onChange={setRange} />

      {error ? (
        <div className="glass-card no-lift p-4">
          <p className="text-[13px]" style={{ color: 'var(--crm-negative)' }}>{error}</p>
        </div>
      ) : null}

      {loading && !hasData ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--crm-text-muted)' }}>Loading…</p>
      ) : (
        <>
          {/* The same hero band the team dashboard leads with, so a manager moving
              between the four boards reads them the same way every time. */}
          <div className="dh-band relative z-10">
            <div className="dh-main">
              <p className="dh-l">Cash collected</p>
              <p className="dh-fig mt-2">{hero.figure}</p>
              <p className="dh-sub">{hero.sub}</p>
            </div>
            <div className="dh-side">
              {hero.side.map(function(s) {
                return (
                  <div key={s.label}>
                    <p className="dh-l">{s.label}</p>
                    <p className="dh-sec-fig">{s.value}</p>
                    <p className="dh-sub" style={{ marginTop: '4px' }}>{s.note}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="td-section relative z-10">
            <div className="td-section-h">
              <h3 className="td-section-t">{cfg.sectionTitle}</h3>
              <span className="td-section-rule" />
              <span className="section-tag">
                {repsReporting} {isCloser
                  ? ('reporting ' + (repsReporting === 1 ? 'day' : 'days'))
                  : ((repsReporting === 1 ? 'rep' : 'reps') + ' reporting')}
              </span>
            </div>
            <div className="td-grid">
              {tiles.filter(Boolean).map(function(t) {
                return (
                  <div key={t.label} className="td-tile">
                    <p className={'td-tile-v' + (t.tone ? ' ' + t.tone : '')}>{t.value}</p>
                    <p className="td-tile-l">{t.label}</p>
                    {t.sub ? <p className="td-tile-s">{t.sub}</p> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="td-section relative z-10">
            <div className="td-section-h">
              <h3 className="td-section-t">By {cfg.noun}</h3>
              <span className="td-section-rule" />
              <span className="section-tag">{sorted.length} {sorted.length === 1 ? 'rep' : 'reps'}</span>
            </div>

            {sorted.length === 0 ? (
              <div className="glass-card no-lift p-10 text-center">
                <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>{cfg.empty}</p>
                {cfg.emptyHint ? (
                  <p className="text-xs mt-2" style={{ color: 'var(--crm-text-muted)' }}>{cfg.emptyHint}</p>
                ) : null}
              </div>
            ) : (
              <div className="glass-card eodt-wrap">
                <table className="eodt">
                  <thead>
                    <tr>
                      {columns.map(function(col) {
                        /* A real button inside the header cell: the sort was
                           previously an onClick on the <th>, which Tab skips
                           entirely, so the table could not be sorted from the
                           keyboard at all. aria-sort tells a screen reader what
                           the arrow is saying. */
                        return (
                          <th
                            key={col.key}
                            scope="col"
                            aria-sort={sortKey === col.key
                              ? (sortDir === 'asc' ? 'ascending' : 'descending')
                              : 'none'}
                            className={sortKey === col.key ? 'eodt-sort' : ''}
                          >
                            <button type="button" className="eodt-sort-btn"
                              onClick={function() { sortBy(col.key); }}>
                              {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(function(row) {
                      /* Only the DM board carries written notes, and only some
                         rows have any. A row with none is not made to look
                         clickable. */
                      var notes = (row.themes || []).length + (row.bottlenecks || []).length;
                      var isOpen = openNotes === row.name;
                      return [
                        <tr key={row.name} className={isOpen ? 'eodt-open' : ''}>
                          {columns.map(function(col) {
                            return (
                              <td key={col.key}>
                                {col.text ? (
                                  <span className="inline-flex items-center gap-2">
                                    <RepAvatar rep={roster.find(row.name)} name={row.name} size={22} />
                                    {notes ? (
                                      <button type="button" className="eodt-expand"
                                        aria-expanded={isOpen}
                                        onClick={function() { setOpenNotes(isOpen ? null : row.name); }}>
                                        {row.name}
                                        <span aria-hidden="true" className="eodt-caret">
                                          {isOpen ? '▾' : '▸'}
                                        </span>
                                      </button>
                                    ) : row.name}
                                  </span>
                                ) : cell(row, col)}
                              </td>
                            );
                          })}
                        </tr>,
                        isOpen ? (
                          <tr key={row.name + '-notes'} className="eodt-plan">
                            <td colSpan={columns.length}>
                              {(row.themes || []).length > 0 ? (
                                <>
                                  <span className="eodt-plan-h">Common themes and patterns</span>
                                  {row.themes.map(function(t, i) {
                                    return (
                                      <p key={i} style={{ color: 'var(--crm-text-bright)', marginBottom: 4 }}>
                                        <span style={{ color: 'var(--crm-text-muted)' }}>{t.date} · </span>{t.text}
                                      </p>
                                    );
                                  })}
                                </>
                              ) : null}
                              {(row.bottlenecks || []).length > 0 ? (
                                <>
                                  <span className="eodt-plan-h" style={{ color: 'var(--crm-warning)', marginTop: 12 }}>
                                    Biggest bottleneck
                                  </span>
                                  {row.bottlenecks.map(function(b, i) {
                                    return (
                                      <p key={i} style={{ color: 'var(--crm-text-bright)', marginBottom: 4 }}>
                                        <span style={{ color: 'var(--crm-text-muted)' }}>{b.date} · </span>{b.text}
                                      </p>
                                    );
                                  })}
                                </>
                              ) : null}
                            </td>
                          </tr>
                        ) : null,
                      ];
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
