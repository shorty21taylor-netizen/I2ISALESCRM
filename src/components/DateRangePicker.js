'use client';

import { useState, useEffect } from 'react';
import { todayInReportTimezone, shiftReportDay } from '@/lib/report-date';

// The date range control, in one place.
//
// Every page that offered these chips used to build the range itself, and each
// one got the timezone slightly differently — midnight in the browser is 5pm
// Pacific the day before on a UTC host, which quietly made "Today" span two of
// the team's days. The presets are counted here, on the team's calendar, once.

export var RANGE_PRESETS = [
  { id: 'today', label: 'Today', days: 0 },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week', days: 7 },
  { id: 'month', label: 'Past Month', days: 30 },
  { id: 'quarter', label: 'Past Quarter', days: 90 },
  { id: 'year', label: 'Past Year', days: 365 },
  { id: 'custom', label: 'Custom' },
];

export function resolveRange(preset, customStart, customEnd) {
  var today = todayInReportTimezone();
  if (preset === 'custom') {
    return { start: customStart || today, end: customEnd || today };
  }
  if (preset === 'yesterday') {
    var y = shiftReportDay(today, -1);
    return { start: y, end: y };
  }
  var found = RANGE_PRESETS.filter(function(p) { return p.id === preset; })[0];
  var days = found && found.days ? found.days : 0;
  return { start: shiftReportDay(today, -days), end: today };
}

export default function DateRangePicker({ value, onChange, disabled }) {
  var v = value || {};
  var s1 = useState(v.preset || 'today'), preset = s1[0], setPreset = s1[1];
  var s2 = useState(v.start || ''), start = s2[0], setStart = s2[1];
  var s3 = useState(v.end || ''), end = s3[0], setEnd = s3[1];

  useEffect(function() {
    var range = resolveRange(preset, start, end);
    if (onChange) onChange({ preset: preset, start: range.start, end: range.end });
    // start/end are only read when the preset is custom, and then only after the
    // person has typed both — an incomplete pair would otherwise fire a range of
    // "today to nothing" on every keystroke.
  }, [preset, preset === 'custom' ? start : '', preset === 'custom' ? end : '']);

  var range = resolveRange(preset, start, end);

  return (
    <div className="drp">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="glass-surface inline-flex rounded-xl p-1 gap-0.5 flex-wrap">
          {RANGE_PRESETS.map(function(opt) {
            return (
              <button
                key={opt.id}
                disabled={disabled}
                onClick={function() { setPreset(opt.id); }}
                className={preset === opt.id
                  ? 'px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-200'
                  : 'px-3 py-1.5 rounded-lg text-xs font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-200 disabled:opacity-40'}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="text-xs font-mono text-crm-muted">
          {range.start} &rarr; {range.end}
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex items-center gap-3 flex-wrap mt-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">From</label>
            <input type="date" value={start} disabled={disabled}
              onChange={function(e) { setStart(e.target.value); }}
              className="input-field" style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-crm-muted">To</label>
            <input type="date" value={end} disabled={disabled}
              onChange={function(e) { setEnd(e.target.value); }}
              className="input-field" style={{ width: '160px', fontSize: '12px', padding: '6px 10px' }} />
          </div>
        </div>
      )}
    </div>
  );
}
