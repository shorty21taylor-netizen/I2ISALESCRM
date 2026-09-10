import { NextResponse } from 'next/server';
import { initStore, getAllCloserProfiles } from '@/lib/store';
import { photoId } from '@/lib/rep-photo';

export var dynamic = 'force-dynamic';

// Serves one profile photo as an image, so a page listing ten reps costs ten
// cacheable image requests instead of a megabyte of base64 in its JSON.
//
// The id is derived from the photo, so it is safe to cache for a long time: a
// new upload produces a new id, and the old URL simply stops being referenced.
export async function GET(req) {
  await initStore();
  try {
    var want = new URL(req.url).searchParams.get('id') || '';
    if (!want) return new Response(null, { status: 404 });

    var profiles = getAllCloserProfiles() || {};
    var match = null;
    Object.keys(profiles).some(function(email) {
      var url = profiles[email] && profiles[email].avatarUrl;
      if (url && photoId(email, url) === want) { match = url; return true; }
      return false;
    });
    if (!match) return new Response(null, { status: 404 });

    // A photo set by https link is somebody else's to serve.
    if (match.indexOf('https://') === 0) return NextResponse.redirect(match);

    var parsed = /^data:([a-z0-9.+/-]+);base64,(.*)$/i.exec(match);
    if (!parsed) return new Response(null, { status: 404 });

    return new Response(Buffer.from(parsed[2], 'base64'), {
      headers: {
        'Content-Type': parsed[1],
        'Cache-Control': 'private, max-age=604800, immutable',
      },
    });
  } catch (err) {
    console.error('[api/avatar]', err);
    return new Response(null, { status: 404 });
  }
}
