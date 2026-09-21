'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Loader2, Building2, User, FileText, AlertTriangle } from 'lucide-react';
import { withWorkspace, apiFetch } from '@/lib/workspace-client';
import { formatCurrency } from '@/lib/utils';

// "Where did that come from?" for the Cash Collected and Revenue tiles.
//
// Those tiles show the HIGHEST of three separate measures of the same money, not
// a sum — a rep who files an EOD and submits the deal form would otherwise be
// counted twice. That is the right call and this panel does not change it. What
// it does is say out loud which of the three is being shown, what the other two
// say, and whose books the money came out of, because "the deal forms say
// $88,941 and the EODs say $27,741" is a reconciliation job, not a rounding
// error, and nothing on the page used to admit it was happening.

function pctOf(part, whole) {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function Bar({ value, max, winning }) {
  var width = max > 0 ? Math.max(1.5, (value / max) * 100) : 0;
  return (
    <div className="cpv-bar">
      <div className="cpv-bar-fill" style={{
        width: width + '%',
        background: winning ? '#22c55e' : 'var(--crm-text-muted)',
        opacity: winning ? 1 : 0.45,
      }} />
    </div>
  );
}

export default function CashProvenance({ start, end, workspaceId }) {
  var s1 = useState(false), open = s1[0], setOpen = s1[1];
  var s2 = useState(null), data = s2[0], setData = s2[1];
  var s3 = useState(false), loading = s3[0], setLoading = s3[1];
  var s4 = useState(''), error = s4[0], setError = s4[1];
  var s5 = useState('deals'), tab = s5[0], setTab = s5[1];

  var load = useCallback(function() {
    if (!workspaceId) return;
    setLoading(true); setError('');
    apiFetch(withWorkspace('/api/dashboard/cash-provenance?start=' + encodeURIComponent(start || '')
      + '&end=' + encodeURIComponent(end || ''), workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setLoading(false);
        if (!d || d.error) { setError((d && d.error) || 'Could not load it.'); return; }
        setData(d.provenance);
      })
      .catch(function(e) { setLoading(false); setError(e.message || 'Could not load it.'); });
  }, [start, end, workspaceId]);

  // Re-read whenever the range or the workspace changes, but only while open —
  // this is a drill-down, not something every dashboard poll should pay for.
  useEffect(function() { if (open) load(); }, [open, load]);

  var sources = (data && data.sources) || [];
  var max = sources.reduce(function(m, s) { return Math.max(m, s.total || 0); }, 0);
  var winner = sources.filter(function(s) { return s.winning; })[0];
  var disagreeing = sources.filter(function(s) { return !s.winning && s.total !== (winner && winner.total); });

  // In a single workspace the column is one repeated value; only the combined
  // view has a question to answer here.
  var workspaceRows = ((data && data.byWorkspace) || []).filter(function(r) {
    return r.deals > 0 || r.eodSplit > 0 || r.eodRevenue > 0;
  });
  var showWorkspaces = workspaceRows.length > 1;
  var winKey = (data && data.winner) || 'deals';

  return (
    <div className="cpv">
      <button className="cpv-toggle" onClick={function() { setOpen(!open); }}>
        <ChevronDown className="w-3.5 h-3.5" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }} />
        Where this came from
        {data && winner ? <span className="cpv-toggle-note">showing {winner.label.toLowerCase()}</span> : null}
      </button>

      {open && (
        <div className="cpv-body">
          {loading && !data ? (
            <p className="cpv-muted"><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-2" />Working it out…</p>
          ) : error ? (
            <p className="cpv-error"><AlertTriangle className="w-3.5 h-3.5 inline mr-2" />{error}</p>
          ) : !data ? null : (
            <>
              {/* The three measures, and which one the tile is showing. */}
              <div className="cpv-sec">
                <h4 className="cpv-h">Three measures of the same money</h4>
                <p className="cpv-note">
                  The tile shows the highest of these, never the sum — a rep who files an EOD
                  and submits the deal form would otherwise be counted twice.
                </p>
                {sources.map(function(s) {
                  return (
                    <div key={s.key} className={'cpv-src' + (s.winning ? ' cpv-src-win' : '')}>
                      <div className="cpv-src-top">
                        <span className="cpv-src-label">
                          {s.label}
                          {s.winning ? <span className="cpv-badge">on the tile</span> : null}
                        </span>
                        <span className="cpv-src-value">{formatCurrency(s.total)}</span>
                      </div>
                      <Bar value={s.total} max={max} winning={s.winning} />
                      <div className="cpv-src-foot">
                        <span>{s.note}</span>
                        {!s.winning && s.shortfall > 0
                          ? <span className="cpv-gap">{formatCurrency(s.shortfall)} less than the tile</span>
                          : null}
                      </div>
                    </div>
                  );
                })}
                {disagreeing.length > 0 && winner ? (
                  <p className="cpv-note cpv-warn">
                    These do not agree. {formatCurrency(winner.total)} is what the floor is credited with;
                    the gap is money recorded in one place and not the other, and it is worth chasing
                    rather than averaging.
                  </p>
                ) : null}
              </div>

              {/* Partner business, named so nobody has to wonder where it went. */}
              {data.partner && data.partner.cash > 0 ? (
                <div className="cpv-sec">
                  <h4 className="cpv-h">Partner business, kept out of the figures above</h4>
                  <p className="cpv-note">
                    {formatCurrency(data.partner.cash)} across {data.partner.deals}{' '}
                    deal{data.partner.deals === 1 ? '' : 's'} — somebody else&rsquo;s offer sold through
                    this floor. It has its own tile on the dashboard and its own leaderboard.
                  </p>
                  <div className="cpv-scroll">
                    <table className="cpv-table">
                      <thead>
                        <tr><th>Date</th><th>Client</th><th>Closer</th><th>Partner</th><th>Cash</th></tr>
                      </thead>
                      <tbody>
                        {(data.partner.rows || []).filter(Boolean).map(function(d) {
                          return (
                            <tr key={d.id}>
                              <td>{d.date}</td>
                              <td>{d.client}</td>
                              <td>{d.rep}</td>
                              <td>{d.program || '—'}</td>
                              <td>{formatCurrency(d.cash)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* The combined view can read lower than its parts. Said first,
                  because it changes what every figure below it means. */}
              {data.understatedBy > 0 && (
                <div className="cpv-sec cpv-understated">
                  <h4 className="cpv-h cpv-h-warn"><AlertTriangle className="w-3.5 h-3.5" /> This combined figure is lower than its parts</h4>
                  <p className="cpv-note">
                    Each workspace on its own is credited with{' '}
                    <strong>{formatCurrency(data.sumOfParts)}</strong> between them, but the combined view
                    compares the three measures across every workspace at once, so the larger measure wins
                    outright and money recorded only in the other one is not added to it. The tile is short by{' '}
                    <strong>{formatCurrency(data.understatedBy)}</strong>.
                  </p>
                  <table className="cpv-table">
                    <thead><tr><th>Workspace</th><th>On its own dashboard</th></tr></thead>
                    <tbody>
                      {(data.perWorkspaceHeadlines || []).map(function(r) {
                        return <tr key={r.key}><td>{r.label}</td><td>{formatCurrency(r.headline)}</td></tr>;
                      })}
                      <tr>
                        <td><strong>Sum</strong></td>
                        <td><strong>{formatCurrency(data.sumOfParts)}</strong></td>
                      </tr>
                      <tr>
                        <td>Shown on the tile</td>
                        <td>{formatCurrency(data.headline)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="cpv-note">
                    Open each workspace separately for the figure that company is actually credited with.
                  </p>
                </div>
              )}

              {/* Whose books it came out of. */}
              {showWorkspaces && (
                <div className="cpv-sec">
                  <h4 className="cpv-h"><Building2 className="w-3.5 h-3.5" /> By workspace</h4>
                  <table className="cpv-table">
                    <thead>
                      <tr>
                        <th>Workspace</th><th>Deal forms</th><th>EOD cash</th><th>EOD revenue</th><th>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workspaceRows.map(function(r) {
                        var share = pctOf(r[winKey], data.headline);
                        return (
                          <tr key={r.key}>
                            <td>{r.label}</td>
                            <td>{formatCurrency(r.deals)}</td>
                            <td>{formatCurrency(r.eodSplit)}</td>
                            <td>{formatCurrency(r.eodRevenue)}</td>
                            <td>{share === null ? '—' : share + '%'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Who brought it in. */}
              {(data.byRep || []).length > 0 && (
                <div className="cpv-sec">
                  <h4 className="cpv-h"><User className="w-3.5 h-3.5" /> By rep</h4>
                  <table className="cpv-table">
                    <thead>
                      <tr>
                        <th>Rep</th><th>Deal forms</th><th>EOD cash</th><th>EOD revenue</th><th>Deals</th><th>EODs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byRep.map(function(r) {
                        return (
                          <tr key={r.key}>
                            <td>{r.label}</td>
                            <td>{formatCurrency(r.deals)}</td>
                            <td>{formatCurrency(r.eodSplit)}</td>
                            <td>{formatCurrency(r.eodRevenue)}</td>
                            <td>{r.dealCount}</td>
                            <td>{r.eodCount}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* The records themselves. */}
              <div className="cpv-sec">
                <h4 className="cpv-h"><FileText className="w-3.5 h-3.5" /> The records behind it</h4>
                <div className="cpv-tabs">
                  <button className={'cpv-tab' + (tab === 'deals' ? ' cpv-tab-on' : '')}
                    onClick={function() { setTab('deals'); }}>
                    Closed deals ({data.counts.deals})
                  </button>
                  <button className={'cpv-tab' + (tab === 'eods' ? ' cpv-tab-on' : '')}
                    onClick={function() { setTab('eods'); }}>
                    EODs carrying cash ({data.counts.eodsWithCash})
                  </button>
                </div>

                {tab === 'deals' ? (
                  (data.deals || []).length === 0
                    ? <p className="cpv-muted">No closed-deal forms in this range.</p>
                    : (
                      <div className="cpv-scroll">
                        <table className="cpv-table">
                          <thead>
                            <tr>
                              <th>Date</th><th>Client</th><th>Closer</th><th>Program</th>
                              {showWorkspaces ? <th>Workspace</th> : null}<th>Cash</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.deals.map(function(d) {
                              return (
                                <tr key={d.id}>
                                  <td>{d.date}</td>
                                  <td>{d.client}</td>
                                  <td>{d.rep}</td>
                                  <td>{d.program || '—'}</td>
                                  {showWorkspaces ? <td>{d.workspace}</td> : null}
                                  <td>
                                    {formatCurrency(d.cash)}
                                    {/* A deal with no collected figure is counted at its
                                        value. Said plainly, because it is not the same thing. */}
                                    {!d.collected && d.dealValue ? <span className="cpv-sub">deal value</span> : null}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                ) : (
                  (data.eods || []).length === 0
                    ? <p className="cpv-muted">No EOD in this range has cash on it.</p>
                    : (
                      <div className="cpv-scroll">
                        <table className="cpv-table">
                          <thead>
                            <tr>
                              <th>Date</th><th>Rep</th>{showWorkspaces ? <th>Workspace</th> : null}
                              <th>MYFM</th><th>I2I</th><th>Split total</th><th>Revenue box</th><th>Closes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.eods.map(function(e) {
                              return (
                                <tr key={e.id}>
                                  <td>{e.date}</td>
                                  <td>{e.rep}</td>
                                  {showWorkspaces ? <td>{e.workspace}</td> : null}
                                  <td>{formatCurrency(e.myfm)}</td>
                                  <td>{formatCurrency(e.i2i)}</td>
                                  <td>{formatCurrency(e.split)}</td>
                                  <td>{formatCurrency(e.revenue)}</td>
                                  <td>{e.closes}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                )}
              </div>

              {data.duplicates && data.duplicates.count > 0 ? (
                <p className="cpv-note cpv-warn">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
                  {data.duplicates.count} deal{data.duplicates.count === 1 ? '' : 's'} in this range look like
                  duplicates, worth {formatCurrency(data.duplicates.cash)}. The tile counts them; the
                  leaderboard does not. Flagged rather than quietly subtracted, so this breakdown still
                  adds up to the figure it is explaining.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
