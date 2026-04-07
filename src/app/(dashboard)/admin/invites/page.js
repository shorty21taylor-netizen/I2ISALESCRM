'use client';
import { useState, useEffect } from 'react';
import { UserPlus, Copy, Check, Link as LinkIcon, Users } from 'lucide-react';
import { getUser } from '@/lib/auth';

export default function InvitesPage() {
  var s1 = useState(''), email = s1[0], setEmail = s1[1];
  var s2 = useState('closer'), role = s2[0], setRole = s2[1];
  var s3 = useState(false), loading = s3[0], setLoading = s3[1];
  var s4 = useState(null), result = s4[0], setResult = s4[1];
  var s5 = useState([]), invites = s5[0], setInvites = s5[1];
  var s6 = useState(null), copiedLink = s6[0], setCopiedLink = s6[1];

  useEffect(function() {
    fetch('/api/auth/invite').then(function(r) { return r.json(); }).then(function(d) { if (d.invites) setInvites(d.invites); });
  }, []);

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      var user = getUser();
      var res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || null, role: role, createdBy: user ? user.name : 'admin' }),
      });
      var data = await res.json();
      if (data.success) {
        setResult(data);
        setInvites(function(prev) { return [data.invite].concat(prev); });
        setEmail('');
      }
    } catch(err) {
      console.error('Invite error:', err);
    }
    setLoading(false);
  }

  function handleCopy(link) {
    navigator.clipboard.writeText(link).then(function() {
      setCopiedLink(link);
      setTimeout(function() { setCopiedLink(null); }, 2000);
    });
  }

  return (
    <div className="p-6 max-w-[900px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-6 h-6 text-crm-accent" />
        <h1 className="font-display text-2xl font-bold text-crm-text-bright">Invite Team Members</h1>
      </div>

      {/* Generate Invite */}
      <div className="glass-card overflow-hidden mb-6 stagger-1">
        <div className="section-header">
          <h3><LinkIcon className="w-4 h-4 text-crm-accent" /> Generate Invite Link</h3>
        </div>
        <div className="p-6">
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={function(e) { setEmail(e.target.value); }}
                  placeholder="closer@email.com"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Role</label>
                <select
                  value={role}
                  onChange={function(e) { setRole(e.target.value); }}
                  className="input-field"
                >
                  <option value="closer">Closer</option>
                  <option value="setter">Setter</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <LinkIcon className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate Invite Link'}
            </button>
          </form>

          {result && result.inviteLink && (
            <div className="mt-4 p-4 rounded-xl bg-crm-positive/5 border border-crm-positive/20">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-crm-positive" />
                <span className="text-sm text-crm-positive font-medium">Invite link generated!</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-xs text-crm-text glass-surface px-3 py-2 truncate">
                  {result.inviteLink}
                </div>
                <button
                  onClick={function() { handleCopy(result.inviteLink); }}
                  className="btn-ghost p-2 flex-shrink-0"
                >
                  {copiedLink === result.inviteLink ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite History */}
      <div className="glass-card overflow-hidden stagger-2">
        <div className="section-header">
          <h3>Invite History</h3>
          <span className="section-tag">{invites.length} invites</span>
        </div>
        <div className="p-5">
          {invites.length > 0 ? (
            <div className="space-y-2">
              {invites.map(function(inv) {
                return (
                  <div key={inv.id} className="flex items-center gap-3 p-3 glass-surface">
                    <Users className="w-4 h-4 text-crm-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-crm-text-bright">{inv.email || 'Open invite'}</div>
                      <div className="text-xs text-crm-muted font-mono">
                        {inv.role} &middot; by {inv.createdBy} &middot; {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <span className={'badge ' + (inv.used ? 'badge-positive' : 'badge-warning')}>
                      {inv.used ? 'Used' : 'Pending'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-sm text-crm-muted py-8">No invites generated yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
