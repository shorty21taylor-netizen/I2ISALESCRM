'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import AwardMedal from '@/components/awards/AwardMedal';
import { RARITY } from '@/lib/awards/definitions';

function stamp(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function criteria(a) {
  var span = { lifetime: 'lifetime', day: 'in a day', week: 'in a week', month: 'in a month', streak: 'in a row' }[a.window] || '';
  if (a.dark) return 'not tracked yet';
  if (a.threshold <= 1) return span === 'lifetime' ? 'once' : span;
  var t = a.threshold < 1
    ? Math.round(a.threshold * 100) + '%'
    : a.threshold.toLocaleString('en-US');
  var v = a.value < 1 && a.value > 0
    ? Math.round(a.value * 100) + '%'
    : Math.round(a.value || 0).toLocaleString('en-US');
  return v + ' / ' + t + ' ' + span;
}

export default function AwardsPanel({ data }) {
  var [showAll, setShowAll] = useState(false);
  if (!data) return null;

  var awards = data.awards || [];
  // Locked awards sort by how close they are, so "Closest to earning" and the
  // top of the grid always tell the same story.
  var shown = showAll ? awards : awards.filter(function(a) {
    return a.earned || (!a.dark && a.percent > 0);
  });
  var ordered = shown.slice().sort(function(a, b) {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return String(b.awardedAt).localeCompare(String(a.awardedAt));
    if (a.dark !== b.dark) return a.dark ? 1 : -1;
    return (b.percent || 0) - (a.percent || 0);
  });
  var next = (data.nextUp || [])[0];

  return (
    <div className="an-card mb-4">
      <div className="an-card-h">
        <h3 className="an-card-t aw-h">Awards</h3>
        <span className="section-tag">{data.earnedCount} of {data.total} earned</span>
        {next ? (
          <span className="aw-next">Closest to earning: <b>{next.name}</b> · {next.percent}%</span>
        ) : null}
        <button className="an-chip" style={{ marginLeft: 'auto' }}
          onClick={function() { setShowAll(!showAll); }}>
          {showAll ? 'Show earned and close' : 'Show every award'}
        </button>
      </div>

      <div className="p-4">
        <div className="aw-grid">
          {ordered.map(function(a) {
            var metal = RARITY[a.rarity] || RARITY.bronze;
            return (
              <div key={a.id} className={'aw-card' + (a.earned ? ' earned' : '') + (a.dark ? ' dark' : '')}
                style={a.earned ? { borderColor: 'var(--metal)' } : {}}
                data-rarity={a.rarity}>
                <div className="aw-top">
                  <AwardMedal icon={a.icon} size={52} className="aw-medal" />
                  <span className="aw-rarity">{metal.label}</span>
                </div>
                <p className="aw-name">{a.name}</p>
                <p className="aw-desc">{a.description}</p>
                <p className="aw-crit">
                  {a.earned ? null : a.dark ? <Lock size={10} /> : null}
                  {criteria(a)}
                </p>
                {a.earned
                  ? <p className="aw-stamp">Earned · {stamp(a.awardedAt)}</p>
                  : a.dark
                    ? <p className="aw-stamp muted">Not measured yet</p>
                    : <div className="aw-bar"><i style={{ width: (a.percent || 0) + '%' }} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
