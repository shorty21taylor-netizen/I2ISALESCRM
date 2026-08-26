'use client';

import { useState, useEffect } from 'react';
import { Phone, DollarSign, ClipboardCheck, Clock, CheckCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { getFormConfig, getPartners } from '@/lib/form-config';
import { useWorkspace, withWorkspace, ALL_WORKSPACES, apiFetch } from '@/lib/workspace-client';

function buildProgramString(brand, myfmDuration, subProgram, partnerName) {
  if (brand === 'MYFM') return 'MYFM - ' + (myfmDuration || '6 Month Coaching');
  if (brand === 'I2I') return 'I2I - ' + (subProgram || 'Digital Program');
  if (brand === 'Partner') return 'Partner - ' + (partnerName || 'Unknown');
  return '';
}

function getWhatsAppForType(formType) {
  var c = getFormConfig();
  if (!c.assistroApiUrl) {
    console.log('[Submit] No assistroApiUrl — WhatsApp disabled');
    return null;
  }
  var groupId = '';
  var disabled = false;

  // Per-form group ID with fallbacks
  if (formType === 'book-call') {
    groupId = c.bookedCallGroupId || c.whatsappGroupId || '';
    disabled = c.bookedCallEnabled === false && c.bookedCallGroupId; // only disabled if explicitly toggled OFF with a group ID set
  } else if (formType === 'close-deal') {
    groupId = c.closedDealGroupId || c.whatsappGroupId || '';
    disabled = c.closedDealEnabled === false && c.closedDealGroupId;
  } else if (formType === 'eod-report') {
    groupId = c.eodReportGroupId || c.whatsappGroupId || '';
    disabled = c.eodReportEnabled === false && c.eodReportGroupId;
  }

  console.log('[Submit] WhatsApp for', formType, '→ groupId:', groupId ? groupId.substring(0, 15) + '...' : 'EMPTY', '| disabled:', disabled);

  // Send if there's a group ID and it's not explicitly disabled
  if (!groupId || disabled) return null;

  return {
    enabled: true,
    apiUrl: c.assistroApiUrl,
    apiKey: c.assistroApiKey || '',
    groupId: groupId,
  };
}

function WhatsAppStatus(props) {
  var c = getFormConfig();
  var groupId = '';
  if (props.formType === 'book-call') groupId = c.bookedCallGroupId || c.whatsappGroupId || '';
  else if (props.formType === 'close-deal') groupId = c.closedDealGroupId || c.whatsappGroupId || '';
  else groupId = c.eodReportGroupId || c.whatsappGroupId || '';
  var ready = c.assistroApiUrl && groupId;
  if (ready) {
    return (
      <div className="flex items-center gap-2 text-xs text-crm-positive font-mono mt-3">
        <div className="w-1.5 h-1.5 rounded-full bg-crm-positive animate-pulse" />
        Sends to WhatsApp instantly
      </div>
    );
  }
  var missing = [];
  if (!c.assistroApiUrl) missing.push('API URL');
  if (!groupId) missing.push('Group ID');
  return (
    <div className="flex items-center gap-2 text-xs text-crm-muted font-mono mt-3">
      <div className="w-1.5 h-1.5 rounded-full bg-crm-muted" />
      {'WhatsApp off — needs: ' + missing.join(', ') + ' (Settings)'}
    </div>
  );
}

var typeBadge = {
  'book-call': { label: 'Booked Call', cls: 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20' },
  'close-deal': { label: 'Closed Deal', cls: 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' },
  'eod-report': { label: 'EOD Report', cls: 'bg-white/5 text-crm-muted border border-crm-border' },
};

export default function SubmitPage() {
  var workspaceId = useWorkspace();
  // "All workspaces" is a viewing mode, not a destination — let the server default
  // to the primary workspace rather than stamping a placeholder id.
  var submitWorkspaceId = (!workspaceId || workspaceId === ALL_WORKSPACES) ? undefined : workspaceId;
  var s1 = useState('book-call'), activeTab = s1[0], setActiveTab = s1[1];
  var s2 = useState([]), submissions = s2[0], setSubmissions = s2[1];
  var s3 = useState(false), submitting = s3[0], setSubmitting = s3[1];
  var s4 = useState(null), successMsg = s4[0], setSuccessMsg = s4[1];
  var s5 = useState(''), error = s5[0], setError = s5[1];
  var s6 = useState(null), user = s6[0], setUser = s6[1];

  // The hosted (n8n) forms are the default way to submit. The built-in forms below
  // stay available as a fallback for anyone who is already inside the CRM.
  var f1 = useState(null), formLinks = f1[0], setFormLinks = f1[1];
  var f2 = useState(true), useExternal = f2[0], setUseExternal = f2[1];
  var f3 = useState(false), showBuiltIn = f3[0], setShowBuiltIn = f3[1];

  useEffect(function() {
    fetch('/api/forms/config')
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.forms) setFormLinks(d.forms);
        if (d && d.useExternalForms === false) setUseExternal(false);
      })
      .catch(function() { /* fall back to the built-in forms */ });
  }, []);

  // Book a Call form
  var b1 = useState(''), bcLeadsName = b1[0], setBcLeadsName = b1[1];
  var b2 = useState(''), bcLeadsPhone = b2[0], setBcLeadsPhone = b2[1];
  var b4 = useState('yes'), bcQualified = b4[0], setBcQualified = b4[1];
  var b5 = useState(''), bcBookedDay = b5[0], setBcBookedDay = b5[1];
  var b6 = useState(''), bcBookedTime = b6[0], setBcBookedTime = b6[1];
  var b7 = useState(''), bcNotes = b7[0], setBcNotes = b7[1];
  var b8 = useState(''), bcSetter = b8[0], setBcSetter = b8[1];
  var b9 = useState(''), bcCloser = b9[0], setBcCloser = b9[1];
  var b10 = useState('inbound'), bcSource = b10[0], setBcSource = b10[1];
  var bb1 = useState(''), bcBrand = bb1[0], setBcBrand = bb1[1];
  var bb2 = useState(''), bcSubProgram = bb2[0], setBcSubProgram = bb2[1];
  var bb3 = useState(''), bcPartnerName = bb3[0], setBcPartnerName = bb3[1];
  var bb4 = useState(''), bcMyfmDuration = bb4[0], setBcMyfmDuration = bb4[1];
  var bb5 = useState(''), bcPricePoint = bb5[0], setBcPricePoint = bb5[1];

  // Close a Deal form
  var c1 = useState(''), cdLeadsName = c1[0], setCdLeadsName = c1[1];
  var c2 = useState(''), cdLeadsPhone = c2[0], setCdLeadsPhone = c2[1];
  var c3 = useState(''), cdLeadsEmail = c3[0], setCdLeadsEmail = c3[1];
  var c5 = useState(''), cdPaymentDetails = c5[0], setCdPaymentDetails = c5[1];
  var c6 = useState(''), cdPaymentProcessor = c6[0], setCdPaymentProcessor = c6[1];
  var c7 = useState(''), cdPaymentAgreement = c7[0], setCdPaymentAgreement = c7[1];
  var c8 = useState(''), cdCashCollected = c8[0], setCdCashCollected = c8[1];
  var c9 = useState(''), cdSetter = c9[0], setCdSetter = c9[1];
  var c10 = useState(''), cdCloser = c10[0], setCdCloser = c10[1];
  var cb1 = useState(''), cdBrand = cb1[0], setCdBrand = cb1[1];
  var cb2 = useState(''), cdSubProgram = cb2[0], setCdSubProgram = cb2[1];
  var cb3 = useState(''), cdPartnerName = cb3[0], setCdPartnerName = cb3[1];
  var cb4 = useState(''), cdMyfmDuration = cb4[0], setCdMyfmDuration = cb4[1];
  var cb5 = useState(''), cdPricePoint = cb5[0], setCdPricePoint = cb5[1];

  var partners = getPartners();

  // EOD Report form
  var e1 = useState(''), eodSalesRep = e1[0], setEodSalesRep = e1[1];
  var e2 = useState(''), eodDate = e2[0], setEodDate = e2[1];
  var e3 = useState(''), eodNetNew = e3[0], setEodNetNew = e3[1];
  var e4 = useState(''), eodOnCalendar = e4[0], setEodOnCalendar = e4[1];
  var e5 = useState(''), eodTaken = e5[0], setEodTaken = e5[1];
  var e6 = useState(''), eodNoShowed = e6[0], setEodNoShowed = e6[1];
  var e7 = useState(''), eodCanceled = e7[0], setEodCanceled = e7[1];
  var e8 = useState(''), eodRescheduled = e8[0], setEodRescheduled = e8[1];
  var e9 = useState(''), eodTakenPitched = e9[0], setEodTakenPitched = e9[1];
  var e10 = useState(''), eodCloses = e10[0], setEodCloses = e10[1];
  var e11 = useState(''), eodDials = e11[0], setEodDials = e11[1];
  var e12 = useState(''), eodCashMYFM = e12[0], setEodCashMYFM = e12[1];
  var e13 = useState(''), eodCashI2I = e13[0], setEodCashI2I = e13[1];
  var e14 = useState(''), eodRevenue = e14[0], setEodRevenue = e14[1];
  var e15 = useState(''), eodPlan = e15[0], setEodPlan = e15[1];

  useEffect(function() {
    var u = getUser();
    if (u) {
      setUser(u);
      setBcCloser(u.name);
      setCdCloser(u.name);
      setEodSalesRep(u.name);
    }
    setEodDate(new Date().toISOString().split('T')[0]);

    apiFetch(withWorkspace('/api/dashboard', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.activity) setSubmissions(data.activity);
      })
      .catch(function() {});
  }, []);

  function clearBookCall() {
    setBcLeadsName(''); setBcLeadsPhone(''); setBcQualified('yes');
    setBcBookedDay(''); setBcBookedTime(''); setBcNotes(''); setBcSetter('');
    setBcCloser(user ? user.name : ''); setBcSource('inbound');
    setBcBrand(''); setBcSubProgram(''); setBcPartnerName(''); setBcMyfmDuration(''); setBcPricePoint('');
  }

  function clearCloseDeal() {
    setCdLeadsName(''); setCdLeadsPhone(''); setCdLeadsEmail('');
    setCdPaymentDetails(''); setCdPaymentProcessor(''); setCdPaymentAgreement('');
    setCdCashCollected(''); setCdSetter(''); setCdCloser(user ? user.name : '');
    setCdBrand(''); setCdSubProgram(''); setCdPartnerName(''); setCdMyfmDuration(''); setCdPricePoint('');
  }

  function clearEOD() {
    setEodNetNew(''); setEodOnCalendar(''); setEodTaken(''); setEodNoShowed('');
    setEodCanceled(''); setEodRescheduled(''); setEodTakenPitched(''); setEodCloses('');
    setEodDials(''); setEodCashMYFM(''); setEodCashI2I(''); setEodRevenue(''); setEodPlan('');
    setEodSalesRep(user ? user.name : '');
    setEodDate(new Date().toISOString().split('T')[0]);
  }

  async function handleSubmitBookCall(evt) {
    evt.preventDefault();
    if (!bcLeadsName.trim()) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var waBC = getWhatsAppForType('book-call');
      var res = await apiFetch('/api/webhooks/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsName: bcLeadsName, leadsPhone: bcLeadsPhone,
          program: buildProgramString(bcBrand, bcMyfmDuration, bcSubProgram, bcPartnerName),
          brand: bcBrand,
          subProgram: bcSubProgram || bcMyfmDuration || bcPartnerName || '',
          pricePoint: bcBrand === 'MYFM' ? bcPricePoint : '',
          qualified: bcQualified, bookedDay: bcBookedDay, bookedTime: bcBookedTime,
          notes: bcNotes, setter: bcSetter, closer: bcCloser, outboundInbound: bcSource,
          closerEmail: user ? user.email : '',
          workspaceId: submitWorkspaceId,
          _whatsapp: waBC,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg('Call booked! WhatsApp notification sent.');
        clearBookCall();
        refreshActivity();
      } else { setError(data.error || 'Failed to submit'); }
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  async function handleSubmitCloseDeal(evt) {
    evt.preventDefault();
    if (!cdLeadsName.trim() || !cdCashCollected) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var waCD = getWhatsAppForType('close-deal');
      var res = await apiFetch('/api/webhooks/close-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsName: cdLeadsName, leadsPhone: cdLeadsPhone, leadsEmail: cdLeadsEmail,
          program: buildProgramString(cdBrand, cdMyfmDuration, cdSubProgram, cdPartnerName),
          brand: cdBrand,
          subProgram: cdSubProgram || cdMyfmDuration || cdPartnerName || '',
          pricePoint: cdBrand === 'MYFM' ? cdPricePoint : '',
          paymentDetails: cdPaymentDetails, paymentProcessor: cdPaymentProcessor,
          paymentAgreement: cdPaymentAgreement, cashCollected: cdCashCollected,
          setter: cdSetter, closer: cdCloser, closerEmail: user ? user.email : '',
          workspaceId: submitWorkspaceId,
          _whatsapp: waCD,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg('Deal closed! Celebration sent to WhatsApp!');
        clearCloseDeal();
        refreshActivity();
      } else { setError(data.error || 'Failed to submit'); }
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  async function handleSubmitEOD(evt) {
    evt.preventDefault();
    if (!eodSalesRep.trim()) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var waEOD = getWhatsAppForType('eod-report');
      var res = await apiFetch('/api/webhooks/eod-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRep: eodSalesRep, date: eodDate,
          netNewCallsBooked: eodNetNew, callsOnCalendar: eodOnCalendar,
          callsTaken: eodTaken, callsNoShowed: eodNoShowed,
          callsCanceled: eodCanceled, callsRescheduled: eodRescheduled,
          callsTakenAndPitched: eodTakenPitched, closes: eodCloses,
          outboundDials: eodDials, cashCollectedMYFM: eodCashMYFM,
          cashCollectedI2I: eodCashI2I, revenueOnDay: eodRevenue,
          improvementPlan: eodPlan,
          closerEmail: user ? user.email : '',
          workspaceId: submitWorkspaceId,
          _whatsapp: waEOD,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg('EOD report submitted!');
        clearEOD();
        refreshActivity();
      } else { setError(data.error || 'Failed to submit'); }
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  function refreshActivity() {
    apiFetch(withWorkspace('/api/dashboard', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.activity) setSubmissions(data.activity);
      })
      .catch(function() {});
  }

  var tabs = [
    { id: 'book-call', label: 'Book a Call', icon: Phone, color: 'crm-accent' },
    { id: 'close-deal', label: 'Close a Deal', icon: DollarSign, color: 'crm-positive' },
    { id: 'eod-report', label: 'End-of-Day', icon: ClipboardCheck, color: 'crm-muted' },
  ];

  return (
    <div>
      <header className="page-header">
        <div className="flex items-center justify-between px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Submit reports</h1>
            <p className="text-xs text-crm-muted font-mono">Book calls, log closes, and submit your end-of-day</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-8 space-y-6">

        {/* ===== HOSTED FORMS (n8n) ===== */}
        {useExternal && formLinks && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { key: 'book-call', icon: Phone, accent: 'text-crm-accent', blurb: 'Setters — log a new booked appointment' },
                { key: 'close-deal', icon: DollarSign, accent: 'text-crm-positive', blurb: 'Closers — ring the bell on a won deal' },
                { key: 'eod-report', icon: ClipboardCheck, accent: 'text-crm-muted', blurb: 'Everyone — end-of-day numbers' },
                { key: 'after-call', icon: FileText, accent: 'text-crm-accent', blurb: 'Closers — recap what happened on the call' },
              ].map(function(card) {
                var link = formLinks[card.key];
                if (!link || !link.url) return null;
                var CardIcon = card.icon;
                return (
                  <a
                    key={card.key}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-card p-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <CardIcon className={'w-5 h-5 ' + card.accent} />
                      <ExternalLink className="w-4 h-4 text-crm-muted" />
                    </div>
                    <div>
                      <div className="font-display font-semibold text-crm-text-bright">{link.label}</div>
                      <div className="text-xs text-crm-muted mt-1">{card.blurb}</div>
                    </div>
                    <div className="text-[11px] font-mono text-crm-muted mt-auto">
                      Logs to the CRM + posts to WhatsApp
                    </div>
                  </a>
                );
              })}
            </div>

            <button
              onClick={function() { setShowBuiltIn(!showBuiltIn); }}
              className="flex items-center gap-2 text-xs font-mono text-crm-muted hover:text-crm-text transition-colors"
            >
              {showBuiltIn ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showBuiltIn ? 'Hide the in-CRM forms' : 'Or submit with the in-CRM forms'}
            </button>
          </div>
        )}

        {(!useExternal || !formLinks || showBuiltIn) && (
        <div className="space-y-6">

        {/* Tab Toggle */}
        <div className="flex items-center justify-center">
          <div className="glass-surface inline-flex rounded-xl p-1">
            {tabs.map(function(tab) {
              var isActive = activeTab === tab.id;
              var TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={function() { setActiveTab(tab.id); setError(''); setSuccessMsg(null); }}
                  className={isActive
                    ? 'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300'
                    : 'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMsg && (
          <div className="glass-card p-4 flex items-center gap-3 border-crm-positive/20 bg-crm-positive/5">
            <CheckCircle className="w-5 h-5 text-crm-positive flex-shrink-0" />
            <span className="text-sm text-crm-positive">{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="glass-card p-4 flex items-center gap-3 border-crm-negative/20 bg-crm-negative/5">
            <span className="text-sm text-crm-negative">{error}</span>
          </div>
        )}

        {/* ===== BOOK A CALL FORM ===== */}
        {activeTab === 'book-call' && (
          <div className="glass-card overflow-hidden stagger-1">
            <div className="section-header">
              <h3><Phone className="w-4 h-4 text-crm-accent" /> Book a Call</h3>
              <span className="section-tag">Sends to WhatsApp</span>
            </div>
            <form onSubmit={handleSubmitBookCall} className="p-6 space-y-5">
              <div className="form-section-title">Lead Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label form-label-required">Lead&apos;s Name</label>
                  <input type="text" value={bcLeadsName} onChange={function(e) { setBcLeadsName(e.target.value); }} className="input-field" placeholder="John Smith" required />
                </div>
                <div>
                  <label className="form-label">Lead&apos;s Phone</label>
                  <input type="text" value={bcLeadsPhone} onChange={function(e) { setBcLeadsPhone(e.target.value); }} className="input-field" placeholder="+1 555-123-4567" />
                </div>
              </div>
              {/* PROGRAM SELECTION — 3-step */}
              <div>
                <label className="form-label">Program</label>

                <div className="flex gap-2 mb-3">
                  {['MYFM', 'I2I', 'Partner'].map(function(bnd) {
                    return (
                      <button
                        key={bnd}
                        type="button"
                        onClick={function() {
                          setBcBrand(bnd);
                          setBcSubProgram('');
                          setBcPartnerName('');
                          setBcMyfmDuration('');
                          setBcPricePoint('');
                        }}
                        className={'flex-1 px-4 py-3 rounded-xl text-sm font-display font-bold transition-all ' +
                          (bcBrand === bnd ? 'text-white' : 'text-crm-muted')}
                        style={bcBrand === bnd ? {
                          background: bnd === 'MYFM' ? '#fafafa' : bnd === 'I2I' ? '#d4d4d4' : '#f59e0b',
                          boxShadow: '0 0 20px ' + (bnd === 'MYFM' ? 'rgba(59,130,246,0.3)' : bnd === 'I2I' ? 'rgba(139,92,246,0.3)' : 'rgba(245,158,11,0.3)')
                        } : { background: 'var(--crm-surface-bg)', border: '1px solid var(--crm-border)' }}
                      >
                        {bnd}
                      </button>
                    );
                  })}
                </div>

                {bcBrand === 'MYFM' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Duration</label>
                      <select value={bcMyfmDuration} onChange={function(e) { setBcMyfmDuration(e.target.value); }} className="input-field">
                        <option value="">Select duration...</option>
                        <option value="6 Month Coaching">6 Month Coaching</option>
                        <option value="12 Month Coaching">12 Month Coaching</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Price Point</label>
                      <input type="number" value={bcPricePoint} onChange={function(e) { setBcPricePoint(e.target.value); }} placeholder="e.g. 6000" className="input-field" />
                    </div>
                  </div>
                )}

                {bcBrand === 'I2I' && (
                  <div>
                    <label className="form-label">Offer</label>
                    <select value={bcSubProgram} onChange={function(e) { setBcSubProgram(e.target.value); }} className="input-field">
                      <option value="">Select offer...</option>
                      <option value="Skool Sales">Skool Sales</option>
                      <option value="Funding Program">Funding Program</option>
                      <option value="Digital Program">Digital Program</option>
                      <option value="Inner Circle">Inner Circle</option>
                    </select>
                  </div>
                )}

                {bcBrand === 'Partner' && (
                  <div>
                    <label className="form-label">Partner</label>
                    <select value={bcPartnerName} onChange={function(e) { setBcPartnerName(e.target.value); }} className="input-field">
                      <option value="">Select partner...</option>
                      {partners.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Qualified?</label>
                  <select value={bcQualified} onChange={function(e) { setBcQualified(e.target.value); }} className="input-field">
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="form-section-title">Scheduling</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Booked Day</label>
                  <input type="date" value={bcBookedDay} onChange={function(e) { setBcBookedDay(e.target.value); }} className="input-field" />
                </div>
                <div>
                  <label className="form-label">Booked Time</label>
                  <input type="time" value={bcBookedTime} onChange={function(e) { setBcBookedTime(e.target.value); }} className="input-field" />
                </div>
              </div>

              <div className="form-section-title">Team</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Setter</label>
                  <input type="text" value={bcSetter} onChange={function(e) { setBcSetter(e.target.value); }} className="input-field" placeholder="Setter name" />
                </div>
                <div>
                  <label className="form-label">Closer</label>
                  <input type="text" value={bcCloser} onChange={function(e) { setBcCloser(e.target.value); }} className="input-field" placeholder="Auto-filled from login" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Source</label>
                  <select value={bcSource} onChange={function(e) { setBcSource(e.target.value); }} className="input-field">
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <textarea value={bcNotes} onChange={function(e) { setBcNotes(e.target.value); }} className="input-field" rows={3} placeholder="Any additional notes..." />
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Phone className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Book Call & Notify Team'}
              </button>
              <WhatsAppStatus formType="book-call" />
            </form>
          </div>
        )}

        {/* ===== CLOSE A DEAL FORM ===== */}
        {activeTab === 'close-deal' && (
          <div className="glass-card overflow-hidden stagger-1">
            <div className="section-header">
              <h3><DollarSign className="w-4 h-4 text-crm-positive" /> Close a Deal</h3>
              <span className="section-tag">Sends celebration to WhatsApp</span>
            </div>
            <form onSubmit={handleSubmitCloseDeal} className="p-6 space-y-5">
              <div className="form-section-title">Lead Information</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label form-label-required">Lead&apos;s Name</label>
                  <input type="text" value={cdLeadsName} onChange={function(e) { setCdLeadsName(e.target.value); }} className="input-field" placeholder="John Smith" required />
                </div>
                <div>
                  <label className="form-label">Lead&apos;s Phone</label>
                  <input type="text" value={cdLeadsPhone} onChange={function(e) { setCdLeadsPhone(e.target.value); }} className="input-field" placeholder="+1 555-123-4567" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Lead&apos;s Email</label>
                  <input type="email" value={cdLeadsEmail} onChange={function(e) { setCdLeadsEmail(e.target.value); }} className="input-field" placeholder="john@email.com" />
                </div>
              </div>

              {/* PROGRAM SELECTION — 3-step */}
              <div>
                <label className="form-label">Program</label>

                <div className="flex gap-2 mb-3">
                  {['MYFM', 'I2I', 'Partner'].map(function(bnd) {
                    return (
                      <button
                        key={bnd}
                        type="button"
                        onClick={function() {
                          setCdBrand(bnd);
                          setCdSubProgram('');
                          setCdPartnerName('');
                          setCdMyfmDuration('');
                          setCdPricePoint('');
                        }}
                        className={'flex-1 px-4 py-3 rounded-xl text-sm font-display font-bold transition-all ' +
                          (cdBrand === bnd ? 'text-white' : 'text-crm-muted')}
                        style={cdBrand === bnd ? {
                          background: bnd === 'MYFM' ? '#fafafa' : bnd === 'I2I' ? '#d4d4d4' : '#f59e0b',
                          boxShadow: '0 0 20px ' + (bnd === 'MYFM' ? 'rgba(59,130,246,0.3)' : bnd === 'I2I' ? 'rgba(139,92,246,0.3)' : 'rgba(245,158,11,0.3)')
                        } : { background: 'var(--crm-surface-bg)', border: '1px solid var(--crm-border)' }}
                      >
                        {bnd}
                      </button>
                    );
                  })}
                </div>

                {cdBrand === 'MYFM' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Duration</label>
                      <select value={cdMyfmDuration} onChange={function(e) { setCdMyfmDuration(e.target.value); }} className="input-field">
                        <option value="">Select duration...</option>
                        <option value="6 Month Coaching">6 Month Coaching</option>
                        <option value="12 Month Coaching">12 Month Coaching</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Price Point</label>
                      <input type="number" value={cdPricePoint} onChange={function(e) { setCdPricePoint(e.target.value); }} placeholder="e.g. 6000" className="input-field" />
                    </div>
                  </div>
                )}

                {cdBrand === 'I2I' && (
                  <div>
                    <label className="form-label">Offer</label>
                    <select value={cdSubProgram} onChange={function(e) { setCdSubProgram(e.target.value); }} className="input-field">
                      <option value="">Select offer...</option>
                      <option value="Skool Sales">Skool Sales</option>
                      <option value="Funding Program">Funding Program</option>
                      <option value="Digital Program">Digital Program</option>
                      <option value="Inner Circle">Inner Circle</option>
                    </select>
                  </div>
                )}

                {cdBrand === 'Partner' && (
                  <div>
                    <label className="form-label">Partner</label>
                    <select value={cdPartnerName} onChange={function(e) { setCdPartnerName(e.target.value); }} className="input-field">
                      <option value="">Select partner...</option>
                      {partners.map(function(p) { return <option key={p} value={p}>{p}</option>; })}
                    </select>
                  </div>
                )}
              </div>

              <div className="form-section-title">Payment</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Details</label>
                  <input type="text" value={cdPaymentDetails} onChange={function(e) { setCdPaymentDetails(e.target.value); }} className="input-field" placeholder="Full pay, 3-pay, etc." />
                </div>
                <div>
                  <label className="form-label">Payment Processor</label>
                  <input type="text" value={cdPaymentProcessor} onChange={function(e) { setCdPaymentProcessor(e.target.value); }} className="input-field" placeholder="Stripe, PayPal, etc." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Agreement</label>
                  <input type="text" value={cdPaymentAgreement} onChange={function(e) { setCdPaymentAgreement(e.target.value); }} className="input-field" placeholder="Agreement URL or details" />
                </div>
                <div>
                  <label className="form-label form-label-required">Cash Collected</label>
                  <input type="number" value={cdCashCollected} onChange={function(e) { setCdCashCollected(e.target.value); }} className="input-field" placeholder="5500" required />
                </div>
              </div>

              <div className="form-section-title">Team</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Setter</label>
                  <input type="text" value={cdSetter} onChange={function(e) { setCdSetter(e.target.value); }} className="input-field" placeholder="Setter name" />
                </div>
                <div>
                  <label className="form-label">Closer</label>
                  <input type="text" value={cdCloser} onChange={function(e) { setCdCloser(e.target.value); }} className="input-field" placeholder="Auto-filled from login" />
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Close Deal & Celebrate!'}
              </button>
              <WhatsAppStatus formType="close-deal" />
            </form>
          </div>
        )}

        {/* ===== EOD REPORT FORM ===== */}
        {activeTab === 'eod-report' && (
          <div className="glass-card overflow-hidden stagger-1">
            <div className="section-header">
              <h3><ClipboardCheck className="w-4 h-4 text-crm-muted" /> End-of-Day Report</h3>
              <span className="section-tag">CRM only</span>
            </div>
            <form onSubmit={handleSubmitEOD} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label form-label-required">Sales Rep</label>
                  <input type="text" value={eodSalesRep} onChange={function(e) { setEodSalesRep(e.target.value); }} className="input-field" placeholder="Your name" required />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={eodDate} onChange={function(e) { setEodDate(e.target.value); }} className="input-field" />
                </div>
              </div>

              <div className="form-section-title">Call Metrics</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Net New Calls Booked</label>
                  <input type="number" value={eodNetNew} onChange={function(e) { setEodNetNew(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Calls on Calendar</label>
                  <input type="number" value={eodOnCalendar} onChange={function(e) { setEodOnCalendar(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Calls Taken</label>
                  <input type="number" value={eodTaken} onChange={function(e) { setEodTaken(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">No-Showed</label>
                  <input type="number" value={eodNoShowed} onChange={function(e) { setEodNoShowed(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Canceled</label>
                  <input type="number" value={eodCanceled} onChange={function(e) { setEodCanceled(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Rescheduled</label>
                  <input type="number" value={eodRescheduled} onChange={function(e) { setEodRescheduled(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Performance</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Calls Taken &amp; Pitched</label>
                  <input type="number" value={eodTakenPitched} onChange={function(e) { setEodTakenPitched(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Closes</label>
                  <input type="number" value={eodCloses} onChange={function(e) { setEodCloses(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Outbound Dials</label>
                  <input type="number" value={eodDials} onChange={function(e) { setEodDials(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Revenue</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Cash Collected (MYFM)</label>
                  <input type="number" value={eodCashMYFM} onChange={function(e) { setEodCashMYFM(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Cash Collected (I2I)</label>
                  <input type="number" value={eodCashI2I} onChange={function(e) { setEodCashI2I(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label className="form-label">Revenue on Day</label>
                  <input type="number" value={eodRevenue} onChange={function(e) { setEodRevenue(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Improvement Plan</div>
              <div>
                <label className="form-label">What will you improve?</label>
                <textarea value={eodPlan} onChange={function(e) { setEodPlan(e.target.value); }} className="input-field" rows={3} placeholder="What will you improve tomorrow? What worked today?" />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit EOD Report'}
              </button>
              <WhatsAppStatus formType="eod-report" />
            </form>
          </div>
        )}

        </div>
        )}

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-crm-muted" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Recent submissions</h3>
          </div>
          {submissions.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Detail</th>
                    <th>Rep</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(0, 15).map(function(s) {
                    var badge = typeBadge[s.type] || typeBadge['eod-report'];
                    return (
                      <tr key={s.id}>
                        <td className="text-xs font-mono text-crm-muted whitespace-nowrap">
                          {new Date(s.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </td>
                        <td>
                          <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium ' + badge.cls}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-sm text-crm-text">{s.detail}</td>
                        <td className="text-sm text-crm-text-bright">{s.closerName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-sm text-crm-muted">
              No submissions yet. Use the forms above to start logging your activity.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
