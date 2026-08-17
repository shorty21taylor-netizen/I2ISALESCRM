'use client';

import { useState, useEffect } from 'react';
import { Phone, DollarSign, ClipboardCheck, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { getFormConfig } from '@/lib/form-config';
import { useWorkspace, withWorkspace, useWorkspaceList } from '@/lib/workspace-client';
import { ALL_WORKSPACES } from '@/lib/workspaces';

var PROGRAMS = [
  { value: 'DFY Funding', label: 'DFY Funding' },
  { value: 'Coaching Digital Offer', label: 'Coaching Digital Offer' },
  { value: 'Coaching Funding Offer', label: 'Coaching Funding Offer' },
  { value: 'Inner Circle Mentorship', label: 'Inner Circle Mentorship' },
  { value: 'MYFM Coaching Offer', label: 'MYFM Coaching Offer' },
];

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
  var s1 = useState('book-call'), activeTab = s1[0], setActiveTab = s1[1];
  var s2 = useState([]), submissions = s2[0], setSubmissions = s2[1];
  var s3 = useState(false), submitting = s3[0], setSubmitting = s3[1];
  var s4 = useState(null), successMsg = s4[0], setSuccessMsg = s4[1];
  var s5 = useState(''), error = s5[0], setError = s5[1];
  var s6 = useState(null), user = s6[0], setUser = s6[1];
  var workspaceId = useWorkspace();
  // "All Workspaces" is a viewing mode, not a destination — let the server infer
  // the owning workspace from the program instead of stamping a bogus id.
  var submitWorkspaceId = (!workspaceId || workspaceId === ALL_WORKSPACES) ? undefined : workspaceId;
  var allWorkspaces = useWorkspaceList();
  var activeWorkspace = null;
  for (var wi = 0; wi < allWorkspaces.length; wi++) {
    if (allWorkspaces[wi].id === submitWorkspaceId) activeWorkspace = allWorkspaces[wi];
  }
  // Legacy companies report cash in two brand columns; anything else gets one field.
  var usesBrandCashFields = !activeWorkspace || !!activeWorkspace.eodCashField;
  var s7 = useState([]), reps = s7[0], setReps = s7[1];

  // Book a Call form
  var b1 = useState(''), bcLeadsName = b1[0], setBcLeadsName = b1[1];
  var b2 = useState(''), bcLeadsPhone = b2[0], setBcLeadsPhone = b2[1];
  var b3 = useState(''), bcProgram = b3[0], setBcProgram = b3[1];
  var b4 = useState('yes'), bcQualified = b4[0], setBcQualified = b4[1];
  var b5 = useState(''), bcBookedDay = b5[0], setBcBookedDay = b5[1];
  var b6 = useState(''), bcBookedTime = b6[0], setBcBookedTime = b6[1];
  var b7 = useState(''), bcNotes = b7[0], setBcNotes = b7[1];
  var b8 = useState(''), bcSetter = b8[0], setBcSetter = b8[1];
  var b9 = useState(''), bcCloser = b9[0], setBcCloser = b9[1];
  var b10 = useState('inbound'), bcSource = b10[0], setBcSource = b10[1];

  // Close a Deal form
  var c1 = useState(''), cdLeadsName = c1[0], setCdLeadsName = c1[1];
  var c2 = useState(''), cdLeadsPhone = c2[0], setCdLeadsPhone = c2[1];
  var c3 = useState(''), cdLeadsEmail = c3[0], setCdLeadsEmail = c3[1];
  var c4 = useState(''), cdProgram = c4[0], setCdProgram = c4[1];
  var c5 = useState(''), cdPaymentDetails = c5[0], setCdPaymentDetails = c5[1];
  var c6 = useState(''), cdPaymentProcessor = c6[0], setCdPaymentProcessor = c6[1];
  var c7 = useState(''), cdPaymentAgreement = c7[0], setCdPaymentAgreement = c7[1];
  var c8 = useState(''), cdCashCollected = c8[0], setCdCashCollected = c8[1];
  var c9 = useState(''), cdSetter = c9[0], setCdSetter = c9[1];
  var c10 = useState(''), cdCloser = c10[0], setCdCloser = c10[1];

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
  var e13b = useState(''), eodCashGeneric = e13b[0], setEodCashGeneric = e13b[1];
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

    fetch(withWorkspace('/api/dashboard', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.activity) setSubmissions(data.activity);
      })
      .catch(function() {});

    fetch('/api/closers')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.success) setReps((d.closers || []).filter(Boolean)); })
      .catch(function() {});
  }, []);

  function clearBookCall() {
    setBcLeadsName(''); setBcLeadsPhone(''); setBcProgram(''); setBcQualified('yes');
    setBcBookedDay(''); setBcBookedTime(''); setBcNotes(''); setBcSetter('');
    setBcCloser(user ? user.name : ''); setBcSource('inbound');
  }

  function clearCloseDeal() {
    setCdLeadsName(''); setCdLeadsPhone(''); setCdLeadsEmail(''); setCdProgram('');
    setCdPaymentDetails(''); setCdPaymentProcessor(''); setCdPaymentAgreement('');
    setCdCashCollected(''); setCdSetter(''); setCdCloser(user ? user.name : '');
  }

  function clearEOD() {
    setEodNetNew(''); setEodOnCalendar(''); setEodTaken(''); setEodNoShowed('');
    setEodCanceled(''); setEodRescheduled(''); setEodTakenPitched(''); setEodCloses('');
    setEodDials(''); setEodCashMYFM(''); setEodCashI2I(''); setEodCashGeneric('');
    setEodRevenue(''); setEodPlan('');
    setEodSalesRep(user ? user.name : '');
    setEodDate(new Date().toISOString().split('T')[0]);
  }

  async function handleSubmitBookCall(evt) {
    evt.preventDefault();
    if (!bcLeadsName.trim()) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var waBC = getWhatsAppForType('book-call');
      var res = await fetch('/api/webhooks/book-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsName: bcLeadsName, leadsPhone: bcLeadsPhone, program: bcProgram,
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
      var res = await fetch('/api/webhooks/close-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadsName: cdLeadsName, leadsPhone: cdLeadsPhone, leadsEmail: cdLeadsEmail,
          program: cdProgram, paymentDetails: cdPaymentDetails, paymentProcessor: cdPaymentProcessor,
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
      var res = await fetch('/api/webhooks/eod-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRep: eodSalesRep, date: eodDate,
          netNewCallsBooked: eodNetNew, callsOnCalendar: eodOnCalendar,
          callsTaken: eodTaken, callsNoShowed: eodNoShowed,
          callsCanceled: eodCanceled, callsRescheduled: eodRescheduled,
          callsTakenAndPitched: eodTakenPitched, closes: eodCloses,
          outboundDials: eodDials, cashCollectedMYFM: eodCashMYFM,
          cashCollectedI2I: eodCashI2I, cashCollected: eodCashGeneric,
          revenueOnDay: eodRevenue,
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
    fetch(withWorkspace('/api/dashboard', workspaceId))
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
        <div className="flex items-center justify-between px-4 md:px-8 h-16">
          <div>
            <h1 className="font-display font-bold text-crm-text-bright text-lg tracking-tight">Submit reports</h1>
            <p className="text-xs text-crm-muted font-mono">Book calls, log closes, and submit your end-of-day</p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 py-6 md:py-8 space-y-6">

        {/* Tab Toggle */}
        <div className="flex items-center justify-center">
          <div className="glass-surface inline-flex flex-wrap rounded-xl p-1">
            {tabs.map(function(tab) {
              var isActive = activeTab === tab.id;
              var TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={function() { setActiveTab(tab.id); setError(''); setSuccessMsg(null); }}
                  className={isActive
                    ? 'flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-lg text-xs md:text-sm font-display font-semibold bg-crm-accent/15 text-crm-accent transition-all duration-300'
                    : 'flex items-center gap-2 px-3 md:px-5 py-2.5 rounded-lg text-xs md:text-sm font-display font-medium text-crm-muted hover:text-crm-text transition-all duration-300'}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label form-label-required">Lead&apos;s Name</label>
                  <input type="text" value={bcLeadsName} onChange={function(e) { setBcLeadsName(e.target.value); }} className="input-field" placeholder="John Smith" required />
                </div>
                <div>
                  <label className="form-label">Lead&apos;s Phone</label>
                  <input type="text" value={bcLeadsPhone} onChange={function(e) { setBcLeadsPhone(e.target.value); }} className="input-field" placeholder="+1 555-123-4567" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Program</label>
                  <select value={bcProgram} onChange={function(e) { setBcProgram(e.target.value); }} className="input-field">
                    <option value="">Select offer...</option>
                    {PROGRAMS.map(function(p) { return <option key={p.value} value={p.value}>{p.label}</option>; })}
                  </select>
                </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Setter</label>
                  <select value={bcSetter} onChange={function(e) { setBcSetter(e.target.value); }} className="input-field">
                    <option value="">Select setter...</option>
                    {reps.map(function(r) { return <option key={r.email} value={r.name}>{r.name}</option>; })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Closer</label>
                  <select value={bcCloser} onChange={function(e) { setBcCloser(e.target.value); }} className="input-field">
                    <option value="">Select closer...</option>
                    {reps.map(function(r) { return <option key={r.email} value={r.name}>{r.name}</option>; })}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label form-label-required">Lead&apos;s Name</label>
                  <input type="text" value={cdLeadsName} onChange={function(e) { setCdLeadsName(e.target.value); }} className="input-field" placeholder="John Smith" required />
                </div>
                <div>
                  <label className="form-label">Lead&apos;s Phone</label>
                  <input type="text" value={cdLeadsPhone} onChange={function(e) { setCdLeadsPhone(e.target.value); }} className="input-field" placeholder="+1 555-123-4567" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Lead&apos;s Email</label>
                  <input type="email" value={cdLeadsEmail} onChange={function(e) { setCdLeadsEmail(e.target.value); }} className="input-field" placeholder="john@email.com" />
                </div>
                <div>
                  <label className="form-label">Program</label>
                  <select value={cdProgram} onChange={function(e) { setCdProgram(e.target.value); }} className="input-field">
                    <option value="">Select offer...</option>
                    {PROGRAMS.map(function(p) { return <option key={p.value} value={p.value}>{p.label}</option>; })}
                  </select>
                </div>
              </div>

              <div className="form-section-title">Payment</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Payment Type</label>
                  <select value={cdPaymentDetails} onChange={function(e) { setCdPaymentDetails(e.target.value); }} className="input-field">
                    <option value="">Select payment type...</option>
                    <option value="Full Pay">Full Pay</option>
                    <option value="2-Pay">2-Pay</option>
                    <option value="3-Pay">3-Pay</option>
                    <option value="4-Pay">4-Pay</option>
                    <option value="6-Pay">6-Pay</option>
                    <option value="12-Pay">12-Pay</option>
                    <option value="Custom Payment Plan">Custom Payment Plan</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Payment Processor</label>
                  <input type="text" value={cdPaymentProcessor} onChange={function(e) { setCdPaymentProcessor(e.target.value); }} className="input-field" placeholder="Stripe, PayPal, etc." />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Setter</label>
                  <select value={cdSetter} onChange={function(e) { setCdSetter(e.target.value); }} className="input-field">
                    <option value="">Select setter...</option>
                    {reps.map(function(r) { return <option key={r.email} value={r.name}>{r.name}</option>; })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Closer</label>
                  <select value={cdCloser} onChange={function(e) { setCdCloser(e.target.value); }} className="input-field">
                    <option value="">Select closer...</option>
                    {reps.map(function(r) { return <option key={r.email} value={r.name}>{r.name}</option>; })}
                  </select>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {usesBrandCashFields ? (
                  <>
                    <div>
                      <label className="form-label">Cash Collected (MYFM)</label>
                      <input type="number" value={eodCashMYFM} onChange={function(e) { setEodCashMYFM(e.target.value); }} className="input-field" placeholder="0" />
                    </div>
                    <div>
                      <label className="form-label">Cash Collected (I2I)</label>
                      <input type="number" value={eodCashI2I} onChange={function(e) { setEodCashI2I(e.target.value); }} className="input-field" placeholder="0" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="form-label">Cash Collected{activeWorkspace ? ' (' + (activeWorkspace.shortName || activeWorkspace.name) + ')' : ''}</label>
                    <input type="number" value={eodCashGeneric} onChange={function(e) { setEodCashGeneric(e.target.value); }} className="input-field" placeholder="0" />
                  </div>
                )}
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

        {/* Recent Submissions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-crm-muted" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Recent submissions</h3>
          </div>
          {submissions.length > 0 ? (
            <div className="glass-card overflow-hidden">
              <div className="table-scroll -mx-4 md:mx-0">
              <table className="data-table min-w-[500px]">
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
