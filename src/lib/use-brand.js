'use client';

import { useEffect, useState } from 'react';

// The brand for screens that run before anyone has signed in. /api/brand carries
// only the logo and the workspace name — nothing that needs a session — so the
// sign-in page can ask for it without being signed in.
//
// `ready` is what callers wait on: it turns true whether the request succeeds or
// fails, so a page never sits blank waiting on a brand it is not going to get.
export default function useBrand() {
  var [brand, setBrand] = useState({ ready: false, logoUrl: '', name: '' });

  useEffect(function() {
    var cancelled = false;
    function done(logoUrl, name) {
      if (!cancelled) setBrand({ ready: true, logoUrl: logoUrl, name: name });
    }
    fetch('/api/brand')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.success) done(d.logoUrl || '', d.name || '');
        else done('', '');
      })
      .catch(function() { done('', ''); });
    return function() { cancelled = true; };
  }, []);

  return brand;
}
