// Never hand a workspace's sign-in credentials to a browser.
//
// The raw workspace record carries teamPasswordSalt and teamPasswordHash. Any
// route that serialises one whole ships that material to its caller, and a salt
// plus a scrypt hash is everything an offline cracker needs to recover the team
// password that opens the workspace.
//
// This lived inside /api/workspaces, which meant the single-workspace route right
// next to it kept returning the hash — so it is shared now rather than copied.
export function publicWorkspace(w) {
  if (!w) return null;
  var out = {};
  Object.keys(w).forEach(function (k) {
    if (/password|salt|hash|secret|token|apiKey/i.test(k)) return;
    out[k] = w[k];
  });
  return out;
}
