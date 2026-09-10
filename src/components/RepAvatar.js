'use client';

import { initialsOf } from '@/lib/use-roster';

// One rep's face, wherever they are listed.
//
// Falls back to their initials, which is all these lists ever had — so a rep who
// has not uploaded a photo looks deliberate rather than broken, and a roster that
// failed to load costs nothing.
export default function RepAvatar({ rep, name, size, className, style, showStatus }) {
  var px = size || 36;
  var label = (rep && rep.name) || name || '';
  var status = showStatus && rep && rep.status ? rep.status : null;

  var box = Object.assign(
    { width: px, height: px, fontSize: Math.round(px * 0.34) },
    style || {}
  );

  return (
    <span
      className={'rep-av' + (className ? ' ' + className : '')}
      style={box}
      data-tone={status ? status.tone : undefined}
      title={status ? label + ' — ' + status.label : label}
    >
      {rep && rep.photo
        ? <img src={'/api/avatar?id=' + encodeURIComponent(rep.photo)} alt={label} />
        : <span className="rep-av-i">{initialsOf(label)}</span>}
      {status ? <span className="rep-av-dot" /> : null}
    </span>
  );
}
