'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, X, Check, LogIn, Layers, Users } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { ALL_WORKSPACES, useWorkspace, setActiveWorkspace, useAccess, apiFetch } from '@/lib/workspace-client';

export default function WorkspacesPage() {
  var router = useRouter();
  var activeWorkspaceId = useWorkspace();
  var access = useAccess();
  var [workspaces, setWorkspaces] = useState([]);
  var [showCreate, setShowCreate] = useState(false);
  var [loading, setLoading] = useState(true);
  var [saving, setSaving] = useState(false);
  var [step, setStep] = useState(1);

  // Onboarding form state
  var [companyName, setCompanyName] = useState('');
  var [ownerName, setOwnerName] = useState('');
  var [ownerEmail, setOwnerEmail] = useState('');
  var [teamPassword, setTeamPassword] = useState('');
  var [industry, setIndustry] = useState('');
  var [teamSize, setTeamSize] = useState('');
  var [avgDealSize, setAvgDealSize] = useState('');
  var [monthlyAdSpend, setMonthlyAdSpend] = useState('');
  var [funnels, setFunnels] = useState([]);
  var [primaryColor, setPrimaryColor] = useState('#a3a3a3');
  var [secondaryColor, setSecondaryColor] = useState('#22c55e');

  var [teamFor, setTeamFor] = useState(null);
  var [teamList, setTeamList] = useState([]);
  var [newMemberEmail, setNewMemberEmail] = useState('');
  var [newMemberName, setNewMemberName] = useState('');
  var [teamMsg, setTeamMsg] = useState(null);

  function openTeam(ws) {
    setTeamFor(ws);
    setTeamMsg(null);
    setNewMemberEmail(''); setNewMemberName('');
    apiFetch('/api/workspaces/' + encodeURIComponent(ws.id) + '/users')
      .then(function(r) { return r.json(); })
      .then(function(d) { setTeamList((d && d.users) || []); })
      .catch(function() { setTeamList([]); });
  }

  function addMember() {
    if (!teamFor || !newMemberEmail.trim()) { setTeamMsg({ ok: false, text: 'Enter an email' }); return; }
    apiFetch('/api/workspaces/' + encodeURIComponent(teamFor.id) + '/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newMemberEmail.trim(), name: newMemberName.trim(), role: 'closer' }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) { setTeamMsg({ ok: false, text: d.error || 'Could not add' }); return; }
        setTeamMsg({ ok: true, text: newMemberEmail.trim() + ' can now access ' + teamFor.name + ' only' });
        setNewMemberEmail(''); setNewMemberName('');
        openTeam(teamFor);
      })
      .catch(function(e) { setTeamMsg({ ok: false, text: e.message }); });
  }

  function enterWorkspace(ws) {
    setActiveWorkspace(ws.id);
    router.push('/');
  }

  useEffect(function() {
    var user = getUser();
    if (!user || user.email !== 'shorty21taylor@gmail.com') { router.push('/'); return; }
    fetchWorkspaces();
  }, []);

  async function fetchWorkspaces() {
    var res = await fetch('/api/workspaces');
    var data = await res.json();
    if (data.success) setWorkspaces(data.workspaces || []);
    setLoading(false);
  }

  function resetForm() {
    setCompanyName(''); setOwnerName(''); setOwnerEmail(''); setTeamPassword('');
    setIndustry(''); setTeamSize(''); setAvgDealSize(''); setMonthlyAdSpend('');
    setFunnels([]); setPrimaryColor('#a3a3a3'); setSecondaryColor('#22c55e');
    setStep(1); setShowCreate(false);
  }

  function toggleFunnel(f) {
    if (funnels.includes(f)) setFunnels(funnels.filter(function(x) { return x !== f; }));
    else setFunnels(funnels.concat([f]));
  }

  async function handleCreate() {
    if (!companyName || !ownerEmail || !teamPassword) return;
    setSaving(true);
    var res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: companyName, ownerName: ownerName, ownerEmail: ownerEmail,
        teamPassword: teamPassword, industry: industry, teamSize: teamSize,
        avgDealSize: avgDealSize, monthlyAdSpend: monthlyAdSpend, funnels: funnels,
        primaryColor: primaryColor, secondaryColor: secondaryColor,
      }),
    });
    var data = await res.json();
    setSaving(false);
    if (data.success) { resetForm(); fetchWorkspaces(); }
  }

  var funnelOptions = ['Challenge Funnel', 'VSL Funnel', 'Webinar Funnel', 'Application Funnel', 'Book a Call', 'Free Trial', 'Cold Outbound', 'Paid Ads', 'Referral', 'Skool', 'Other'];

  return (
    <div className="min-h-screen">
      <header className="page-header py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>Workspaces</h1>
            <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Manage teams and organizations</p>
          </div>
          <button onClick={function() { setShowCreate(true); setStep(1); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Workspace
          </button>
        </div>
      </header>

      <div className="px-4 md:px-8 pb-8">

        {/* Workspace cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={function() { setActiveWorkspace(ALL_WORKSPACES); router.push('/'); }}
            className="glass-card p-5 text-left w-full transition-all hover:-translate-y-0.5"
            style={{ borderLeft: '4px solid ' + ((!activeWorkspaceId || activeWorkspaceId === ALL_WORKSPACES) ? 'var(--crm-text-bright)' : 'var(--crm-border-hover)') }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>All Workspaces</h3>
                <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Combined view</p>
              </div>
              <Layers className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--crm-muted)' }} />
            </div>
            <div className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
              Every client rolled into one set of numbers
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '0.5px solid var(--glass-surface-border)' }}>
              {(!activeWorkspaceId || activeWorkspaceId === ALL_WORKSPACES) ? (
                <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--crm-text-bright)' }}>
                  <Check className="w-3.5 h-3.5" /> Current view
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--crm-muted)' }}>
                  <LogIn className="w-3.5 h-3.5" /> View combined
                </span>
              )}
            </div>
          </button>

          {workspaces.map(function(ws) {
            var isCurrent = ws.id === activeWorkspaceId;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={function() { enterWorkspace(ws); }}
                aria-current={isCurrent ? 'true' : undefined}
                className="glass-card p-5 text-left w-full transition-all hover:-translate-y-0.5"
                style={{ borderLeft: '4px solid ' + (isCurrent ? 'var(--crm-text-bright)' : 'var(--crm-border-hover)') }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-display font-bold truncate" style={{ color: 'var(--crm-text-bright)' }}>{ws.name}</h3>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--crm-text-muted)' }}>{ws.ownerEmail}</p>
                  </div>
                  <span className={'text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ' + (ws.active !== false ? 'text-crm-positive bg-crm-positive/10' : 'text-crm-muted bg-white/5')}>
                    {ws.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                  {ws.onboarding && ws.onboarding.industry && <span>{ws.onboarding.industry}</span>}
                  {ws.onboarding && ws.onboarding.teamSize && <span>{ws.onboarding.teamSize} reps</span>}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '0.5px solid var(--glass-surface-border)' }}>
                  {isCurrent ? (
                    <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--crm-text-bright)' }}>
                      <Check className="w-3.5 h-3.5" /> Current workspace
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-mono" style={{ color: 'var(--crm-muted)' }}>
                      <LogIn className="w-3.5 h-3.5" /> Enter workspace
                    </span>
                  )}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={function(e) { e.stopPropagation(); openTeam(ws); }}
                    onKeyDown={function(e) { if (e.key === 'Enter') { e.stopPropagation(); openTeam(ws); } }}
                    className="ml-auto flex items-center gap-1.5 text-xs font-mono hover:underline"
                    style={{ color: 'var(--crm-muted)' }}
                  >
                    <Users className="w-3.5 h-3.5" /> Team
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {!loading && workspaces.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--crm-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--crm-text-muted)' }}>No workspaces yet. Create your first one.</p>
          </div>
        )}
      </div>

      {/* Team panel — who can access this workspace */}
      {teamFor && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={function() { setTeamFor(null); }}
        >
          <div className="glass-card w-full max-w-lg p-5" onClick={function(e) { e.stopPropagation(); }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>{teamFor.name} — Team</h3>
                <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>
                  People added here can only see this workspace
                </p>
              </div>
              <button onClick={function() { setTeamFor(null); }} className="btn-ghost p-2" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
              {teamList.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--crm-text-muted)' }}>No one added yet.</p>
              )}
              {teamList.map(function(u) {
                return (
                  <div key={u.id || u.email} className="glass-surface p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--crm-text-bright)' }}>{u.name || u.email}</div>
                      <div className="text-xs font-mono truncate" style={{ color: 'var(--crm-text-muted)' }}>{u.email}</div>
                    </div>
                    <span className="section-tag flex-shrink-0">{u.role || 'closer'}</span>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>Email</label>
                <input className="input-field text-sm" value={newMemberEmail} placeholder="person@company.com"
                  onChange={function(e) { setNewMemberEmail(e.target.value); }} />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: 'var(--crm-text-muted)' }}>Name</label>
                <input className="input-field text-sm" value={newMemberName} placeholder="Optional"
                  onChange={function(e) { setNewMemberName(e.target.value); }} />
              </div>
            </div>

            {teamMsg && (
              <p className={'text-xs font-mono mt-3 ' + (teamMsg.ok ? 'text-crm-positive' : 'text-crm-negative')}>{teamMsg.text}</p>
            )}

            <button onClick={addMember} className="btn-primary text-sm flex items-center gap-2 mt-4">
              <Plus className="w-3.5 h-3.5" /> Add to workspace
            </button>
          </div>
        </div>
      )}

      {/* Create workspace modal — 3-step onboarding */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-0">
              <div>
                <h2 className="text-lg font-display font-bold" style={{ color: 'var(--crm-text-bright)' }}>New Workspace</h2>
                <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>Step {step} of 3</p>
              </div>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/5">
                <X className="w-4 h-4" style={{ color: 'var(--crm-text-muted)' }} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1 px-5 pt-3">
              {[1, 2, 3].map(function(s) {
                return <div key={s} className="flex-1 h-1 rounded-full" style={{ background: s <= step ? 'var(--crm-accent)' : 'var(--crm-surface-bg)' }} />;
              })}
            </div>

            <div className="p-5">

              {/* Step 1: Company Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-display font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-accent)' }}>Company Information</h3>

                  <div>
                    <label className="form-label">Company Name *</label>
                    <input value={companyName} onChange={function(e) { setCompanyName(e.target.value); }} placeholder="e.g. Summit Closers" className="input-field" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Owner Name *</label>
                      <input value={ownerName} onChange={function(e) { setOwnerName(e.target.value); }} placeholder="John Smith" className="input-field" />
                    </div>
                    <div>
                      <label className="form-label">Owner Email *</label>
                      <input value={ownerEmail} onChange={function(e) { setOwnerEmail(e.target.value); }} placeholder="john@company.com" className="input-field" />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Team Password *</label>
                    <input value={teamPassword} onChange={function(e) { setTeamPassword(e.target.value); }} placeholder="Their closers use this to log in" className="input-field" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Industry</label>
                      <select value={industry} onChange={function(e) { setIndustry(e.target.value); }} className="input-field">
                        <option value="">Select...</option>
                        <option>Sales Coaching</option>
                        <option>SaaS</option>
                        <option>Agency</option>
                        <option>Consulting</option>
                        <option>E-commerce</option>
                        <option>Financial Services</option>
                        <option>Real Estate</option>
                        <option>Health &amp; Fitness</option>
                        <option>Education</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Team Size</label>
                      <select value={teamSize} onChange={function(e) { setTeamSize(e.target.value); }} className="input-field">
                        <option value="">Select...</option>
                        <option>1-3</option>
                        <option>3-5</option>
                        <option>5-10</option>
                        <option>10-25</option>
                        <option>25-50</option>
                        <option>50+</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Sales Details */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-display font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-accent)' }}>Sales &amp; Marketing</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Avg Deal Size</label>
                      <input value={avgDealSize} onChange={function(e) { setAvgDealSize(e.target.value); }} placeholder="e.g. $5,000" className="input-field" />
                    </div>
                    <div>
                      <label className="form-label">Monthly Ad Spend</label>
                      <select value={monthlyAdSpend} onChange={function(e) { setMonthlyAdSpend(e.target.value); }} className="input-field">
                        <option value="">Select...</option>
                        <option>$0 - $5k</option>
                        <option>$5k - $15k</option>
                        <option>$15k - $50k</option>
                        <option>$50k - $100k</option>
                        <option>$100k+</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="form-label">What funnels do they run?</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {funnelOptions.map(function(f) {
                        var selected = funnels.includes(f);
                        return (
                          <button key={f} type="button" onClick={function() { toggleFunnel(f); }}
                            className={'px-3 py-1.5 rounded-lg text-xs font-display transition-all ' + (selected ? 'font-bold text-white' : 'text-crm-muted')}
                            style={selected ? { background: 'var(--crm-accent)' } : { background: 'var(--crm-surface-bg)', border: '1px solid var(--crm-border)' }}
                          >{f}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Branding */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-display font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--crm-accent)' }}>Branding</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Primary Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={primaryColor} onChange={function(e) { setPrimaryColor(e.target.value); }} className="w-12 h-12 rounded-lg border-0 cursor-pointer" style={{ background: 'transparent' }} />
                        <input value={primaryColor} onChange={function(e) { setPrimaryColor(e.target.value); }} className="input-field flex-1 font-mono text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Secondary Color</label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={secondaryColor} onChange={function(e) { setSecondaryColor(e.target.value); }} className="w-12 h-12 rounded-lg border-0 cursor-pointer" style={{ background: 'transparent' }} />
                        <input value={secondaryColor} onChange={function(e) { setSecondaryColor(e.target.value); }} className="input-field flex-1 font-mono text-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="glass-surface rounded-xl p-4 mt-4" style={{ borderLeft: '4px solid ' + primaryColor }}>
                    <p className="text-sm font-display font-bold" style={{ color: primaryColor }}>{companyName || 'Company Name'}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--crm-text-muted)' }}>{ownerEmail || 'owner@email.com'} · {teamSize || '?'} reps · {industry || 'Industry'}</p>
                    <div className="flex gap-2 mt-2">
                      <div className="px-3 py-1 rounded-lg text-xs font-bold text-white" style={{ background: primaryColor }}>Primary</div>
                      <div className="px-3 py-1 rounded-lg text-xs font-bold text-white" style={{ background: secondaryColor }}>Secondary</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center gap-3 mt-6 pt-4" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
                {step > 1 && (
                  <button onClick={function() { setStep(step - 1); }} className="btn-ghost flex-1">Back</button>
                )}
                {step < 3 ? (
                  <button onClick={function() { setStep(step + 1); }} disabled={step === 1 && (!companyName || !ownerEmail || !teamPassword)} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-display font-bold text-white disabled:opacity-40" style={{ background: 'var(--crm-accent)' }}>
                    Continue
                  </button>
                ) : (
                  <button onClick={handleCreate} disabled={saving} className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-xl text-sm font-display font-bold text-white disabled:opacity-60" style={{ background: 'var(--crm-accent)' }}>
                    <Check className="w-4 h-4" />
                    {saving ? 'Creating...' : 'Create Workspace'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
