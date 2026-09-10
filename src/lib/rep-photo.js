import crypto from 'crypto';

// A profile photo is addressed by an opaque id rather than by the rep's email.
//
// Two reasons. An <img> tag sends no headers of ours, so the avatar endpoint
// cannot check the caller the way every other route does; addressing by a
// derived id means a photo cannot be pulled without first having been handed the
// roster, which does check. And because the id is derived from the image itself,
// it changes the moment someone uploads a new one — so the URL can be cached
// hard and still never go stale.
export function photoId(email, avatarUrl) {
  if (!email || !avatarUrl) return '';
  return crypto.createHash('sha256')
    .update(String(email).toLowerCase() + '\n' + avatarUrl)
    .digest('hex')
    .slice(0, 32);
}
