'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneCall, DollarSign, ClipboardCheck, Clock, CheckCircle, Loader2, ExternalLink, ChevronDown, ChevronUp, FileText, CalendarDays, Copy, Check, Settings2, AlertTriangle, Share2, MessageCircle } from 'lucide-react';
import { getUser } from '@/lib/auth';
import { getFormConfig, getPartners } from '@/lib/form-config';
import { useWorkspace, withWorkspace, ALL_WORKSPACES, apiFetch } from '@/lib/workspace-client';
import SubmitCelebration from '@/components/SubmitCelebration';
import EodAutofill from '@/components/EodAutofill';
import RepPicker from '@/components/RepPicker';
import useRoster from '@/lib/use-roster';
import {
  PROGRAMS, BOOKING_SOURCES, LEAD_TEMPERATURES, CALL_OUTCOMES, outcomeKind,
  PROGRAM_DURATIONS, PAYMENT_PLATFORMS, PAYMENT_TYPES, PAYMENT_FREQUENCIES,
  needsSchedule, FOLLOWUP_REASONS, LOST_REASONS,
  SETTER_TYPES, DM_OBJECTIONS, PHONE_OBJECTIONS, LEAD_SOURCES,
} from '@/lib/i2i-forms';
import { toReportDay } from '@/lib/report-date';

// The icon set an admin picks from. Stored as a name on the form row so the
// choice survives without the page compiling in a list of forms.
// The three end-of-day reports, and what each one is for. One list, so the
// chooser, the form it opens and the position stamped on the record can never
// name three different things.
var EOD_KINDS = [
  { id: 'closer', label: 'Closer', blurb: 'You took the calls and pitched' },
  { id: 'setter', label: 'Setter', blurb: 'You worked the phone and set calls' },
  { id: 'dm-setter', label: 'DM Setter', blurb: 'You worked the inbox' },
];

// The roster's word for someone, in the chooser's vocabulary. Marked as theirs,
// never selected for them.
function kindFromRole(role) {
  var r = String(role || '').toLowerCase();
  if (r.indexOf('dm') !== -1) return 'dm-setter';
  if (r.indexOf('setter') !== -1) return 'setter';
  if (r.indexOf('closer') !== -1) return 'closer';
  return '';
}

var ICON_FOR = {
  'phone': Phone,
  'dollar': DollarSign,
  'clipboard-check': ClipboardCheck,
  'document': FileText,
  'calendar': CalendarDays,
};

var ACCENT_FOR = {
  accent: 'text-crm-accent',
  positive: 'text-crm-positive',
  neutral: 'text-crm-muted',
};

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
  var router = useRouter();
  // "All workspaces" is a viewing mode, not a destination — let the server default
  // to the primary workspace rather than stamping a placeholder id.
  var submitWorkspaceId = (!workspaceId || workspaceId === ALL_WORKSPACES) ? undefined : workspaceId;
  // The floor, for every name field on every form. One fetch, scoped to the
  // workspace being filed into, refetched when it is switched.
  var roster = useRoster();
  var s1 = useState('book-call'), activeTab = s1[0], setActiveTab = s1[1];
  var s2 = useState([]), submissions = s2[0], setSubmissions = s2[1];
  var s3 = useState(false), submitting = s3[0], setSubmitting = s3[1];
  var s4 = useState(null), successMsg = s4[0], setSuccessMsg = s4[1];
  // Only the two forms that score get one. An end-of-day is reporting, not a win,
  // and a celebration on every submit is a celebration on none of them.
  var s9 = useState(null), celebrate = s9[0], setCelebrate = s9[1];
  var s5 = useState(''), error = s5[0], setError = s5[1];
  var s6 = useState(null), user = s6[0], setUser = s6[1];

  // Below `user` deliberately: `var` hoists the binding but not the useState
  // assignment, so computing this above read an undefined user and badged nobody.
  //
  // The roster's word, not the browser's. localStorage stores role with a
  // 'closer' default for anybody whose membership never said one, so reading it
  // there would badge every unassigned setter as a closer.
  var myRow = user && user.email ? roster.findByEmail(user.email) : null;
  var rosterKind = kindFromRole(myRow && myRow.role);

  // The hosted (n8n) forms are the default way to submit. The built-in forms below
  // stay available as a fallback for anyone who is already inside the CRM.
  var f4 = useState(null), bookingLink = f4[0], setBookingLink = f4[1];
  // The hosted forms this workspace files on. Empty for a workspace that files
  // only here, and the cards are then not rendered at all.
  var h1 = useState([]), reportLinks = h1[0], setReportLinks = h1[1];
  var h2 = useState(''), copiedReport = h2[0], setCopiedReport = h2[1];
  // A workspace that files on hosted forms does not need the CRM's own tabs in
  // front of it. They are hidden rather than deleted: clearing the report-link
  // settings brings them straight back, and a workspace that files here is
  // untouched. Nothing on the floor is filed twice because only one set shows.
  var h3 = useState(false), showInternal = h3[0], setShowInternal = h3[1];

  var f5 = useState(false), copiedLink = f5[0], setCopiedLink = f5[1];

  var f6 = useState(null), formsConfig = f6[0], setFormsConfig = f6[1];
  var f7 = useState(false), canShare = f7[0], setCanShare = f7[1];

  // Below the state it reads, deliberately: `var` hoists the binding but not the
  // useState assignment, so computing this above read an undefined list.
  var hostedOnly = (reportLinks || []).length > 0 && !showInternal;

  // Read once on mount rather than at render: navigator is absent on the server.
  useEffect(function() {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // Everything on this page belongs to one workspace. The server decides which
  // from the session; the id here only makes the request refetch on a switch.
  useEffect(function() {
    if (!workspaceId) return;
    apiFetch(withWorkspace('/api/forms/config', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d || !d.success) return;
        setFormsConfig(d);
        // Null is a real answer: this workspace has no booking link, so no card.
        setBookingLink(d.bookingLink || null);
        setReportLinks(d.reportLinks || []);
      })
      .catch(function() { setFormsConfig({ forms: [], bookingLink: null }); setReportLinks([]); });
  }, [workspaceId]);

  // Book a Call form
  var b1 = useState(''), bcLeadsName = b1[0], setBcLeadsName = b1[1];
  var b2 = useState(''), bcLeadsPhone = b2[0], setBcLeadsPhone = b2[1];
  var b4 = useState('yes'), bcQualified = b4[0], setBcQualified = b4[1];
  var b5 = useState(''), bcBookedDay = b5[0], setBcBookedDay = b5[1];
  var b6 = useState(''), bcBookedTime = b6[0], setBcBookedTime = b6[1];
  var b7 = useState(''), bcNotes = b7[0], setBcNotes = b7[1];
  var b8 = useState(''), bcSetter = b8[0], setBcSetter = b8[1];
  var b9 = useState(''), bcCloser = b9[0], setBcCloser = b9[1];
  var b10 = useState(''), bcSource = b10[0], setBcSource = b10[1];
  var b11 = useState(''), bcLeadsEmail = b11[0], setBcLeadsEmail = b11[1];
  var b12 = useState(''), bcProgram = b12[0], setBcProgram = b12[1];
  var b13 = useState(''), bcTemperature = b13[0], setBcTemperature = b13[1];
  var b14 = useState(''), bcGoal = b14[0], setBcGoal = b14[1];
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
  // Required: the server refuses a deal without it.
  var cdr = useState(''), cdRecording = cdr[0], setCdRecording = cdr[1];
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

  // After-call report. Until now the only way to file one was a hosted n8n form,
  // which is a large part of why n8n was still load-bearing for this product.
  var a1 = useState(''), acLeadsName = a1[0], setAcLeadsName = a1[1];
  var a2 = useState(''), acLeadsPhone = a2[0], setAcLeadsPhone = a2[1];
  var a3 = useState(''), acLeadsEmail = a3[0], setAcLeadsEmail = a3[1];
  var a4 = useState(''), acCloser = a4[0], setAcCloser = a4[1];
  var a5 = useState(''), acOutcome = a5[0], setAcOutcome = a5[1];
  var a6 = useState(''), acNextStep = a6[0], setAcNextStep = a6[1];
  var a7 = useState(''), acNotes = a7[0], setAcNotes = a7[1];
  var a8 = useState(''), acRecording = a8[0], setAcRecording = a8[1];
  // The closer's End-of-Call Report, as the floor's own form asks it. One form,
  // three branches, and on a close it files two records: the after-call report is
  // the account of the call, the closed deal is the money. Neither is double
  // counted — cash comes off deals, calls come off reports.
  var q1 = useState(''), acProgram = q1[0], setAcProgram = q1[1];
  var q2 = useState(''), acDuration = q2[0], setAcDuration = q2[1];
  var q3 = useState(''), acDealValue = q3[0], setAcDealValue = q3[1];
  var q4 = useState(''), acCash = q4[0], setAcCash = q4[1];
  var q5 = useState(''), acPlatform = q5[0], setAcPlatform = q5[1];
  var q6 = useState(''), acOwnCard = q6[0], setAcOwnCard = q6[1];
  var q7 = useState(''), acPayerName = q7[0], setAcPayerName = q7[1];
  var q8 = useState(''), acPayerEmail = q8[0], setAcPayerEmail = q8[1];
  var q9 = useState(''), acPaymentType = q9[0], setAcPaymentType = q9[1];
  var q10 = useState(''), acStructure = q10[0], setAcStructure = q10[1];
  var q11 = useState(''), acFrequency = q11[0], setAcFrequency = q11[1];
  var q12 = useState(''), acNextPayDate = q12[0], setAcNextPayDate = q12[1];
  var q13 = useState(''), acNextPayAmount = q13[0], setAcNextPayAmount = q13[1];
  var q14 = useState(''), acRemaining = q14[0], setAcRemaining = q14[1];
  var q15 = useState(''), acFollowupReason = q15[0], setAcFollowupReason = q15[1];
  var q16 = useState(''), acFollowupDate = q16[0], setAcFollowupDate = q16[1];
  var q17 = useState(''), acLostReason = q17[0], setAcLostReason = q17[1];

  // DM setter end-of-day. The same EOD record as above, filed against the inbox
  // funnel rather than the phone one, and carrying Position so eodRole() files it
  // onto the DM board instead of guessing from the numbers.
  var m1 = useState(''), dmRep = m1[0], setDmRep = m1[1];
  var m2 = useState(''), dmDate = m2[0], setDmDate = m2[1];
  var m3 = useState(''), dmNewLeads = m3[0], setDmNewLeads = m3[1];
  var m4 = useState(''), dmConversations = m4[0], setDmConversations = m4[1];
  var m5 = useState(''), dmBooked = m5[0], setDmBooked = m5[1];
  var m6 = useState(''), dmShowed = m6[0], setDmShowed = m6[1];
  var m7 = useState(''), dmCloses = m7[0], setDmCloses = m7[1];
  var m8 = useState(''), dmCash = m8[0], setDmCash = m8[1];
  var m9 = useState(''), dmGhosted = m9[0], setDmGhosted = m9[1];
  var m10 = useState(''), dmReactivated = m10[0], setDmReactivated = m10[1];
  var m11 = useState(''), dmThemes = m11[0], setDmThemes = m11[1];
  var m12 = useState(''), dmBottleneck = m12[0], setDmBottleneck = m12[1];

  // Which end-of-day is being filed. Deliberately empty until the rep says: a
  // setter filing on the closer form answered six questions about calls they
  // never took and left every number they DID work on unasked, and the report
  // landed on the closer board with a wall of zeros on it.
  //
  // Not pre-selected from the roster, even when the roster knows. `position` is
  // the field eodRole() reads to decide which funnel a day belongs to, and a
  // default that is quietly wrong is the kind of wrong nobody notices — the
  // roster role is marked as theirs instead, so it is one tap rather than none.
  var ek = useState(''), eodKind = ek[0], setEodKind = ek[1];

  // Phone setter end-of-day. Carries no callsTaken, callsOnCalendar or
  // callsTakenAndPitched at all — eodRole() treats evidence of closing as
  // outranking the stated position, so a single one of those fields would file a
  // setter's day onto the closer board.
  var p1 = useState(''), stRep = p1[0], setStRep = p1[1];
  var p2 = useState(''), stDate = p2[0], setStDate = p2[1];
  var p3 = useState(''), stDials = p3[0], setStDials = p3[1];
  var p4 = useState(''), stConversations = p4[0], setStConversations = p4[1];
  var p5 = useState(''), stLiveCalls = p5[0], setStLiveCalls = p5[1];
  var p6 = useState(''), stTalkTime = p6[0], setStTalkTime = p6[1];
  var p7 = useState(''), stSets = p7[0], setStSets = p7[1];
  var p8 = useState(''), stFollowUps = p8[0], setStFollowUps = p8[1];
  var p9 = useState(''), stCloses = p9[0], setStCloses = p9[1];
  var p10 = useState(''), stCash = p10[0], setStCash = p10[1];
  var p11 = useState(''), stCloser = p11[0], setStCloser = p11[1];
  var p12 = useState(''), stRating = p12[0], setStRating = p12[1];
  var p13 = useState(''), stPlan = p13[0], setStPlan = p13[1];
  var p14 = useState(''), stLeadSource = p14[0], setStLeadSource = p14[1];
  var p15 = useState(''), stObjection = p15[0], setStObjection = p15[1];
  // The DM day takes several objections, so this one is a list.
  var p16 = useState([]), dmObjections = p16[0], setDmObjections = p16[1];
  var p17 = useState(''), dmFollowUps = p17[0], setDmFollowUps = p17[1];

  function toggleDmObjection(name) {
    setDmObjections(function(prev) {
      return prev.indexOf(name) === -1
        ? prev.concat([name])
        : prev.filter(function(x) { return x !== name; });
    });
  }


  // The two end-of-day forms, as a key -> value map and a key -> setter map, so the
  // autofill strip can read what is already typed and write only the blanks without
  // knowing anything about this component's state layout.
  function eodValues() {
    return {
      netNewCallsBooked: eodNetNew, callsOnCalendar: eodOnCalendar,
      callsTaken: eodTaken, callsNoShowed: eodNoShowed,
      callsCanceled: eodCanceled, callsRescheduled: eodRescheduled,
      callsTakenAndPitched: eodTakenPitched, closes: eodCloses,
      outboundDials: eodDials, cashCollectedMYFM: eodCashMYFM,
      cashCollectedI2I: eodCashI2I, revenueOnDay: eodRevenue,
      improvementPlan: eodPlan,
    };
  }

  function applyEodDraft(next) {
    var setters = {
      netNewCallsBooked: setEodNetNew, callsOnCalendar: setEodOnCalendar,
      callsTaken: setEodTaken, callsNoShowed: setEodNoShowed,
      callsCanceled: setEodCanceled, callsRescheduled: setEodRescheduled,
      callsTakenAndPitched: setEodTakenPitched, closes: setEodCloses,
      outboundDials: setEodDials, cashCollectedMYFM: setEodCashMYFM,
      cashCollectedI2I: setEodCashI2I, revenueOnDay: setEodRevenue,
      improvementPlan: setEodPlan,
    };
    Object.keys(next || {}).forEach(function(key) {
      if (setters[key]) setters[key](String(next[key]));
    });
  }

  function setterValues() {
    return {
      outboundDials: stDials, conversations: stConversations,
      sets: stSets, followUpsScheduled: stFollowUps, improvementPlan: stPlan,
    };
  }

  function applySetterDraft(next) {
    var setters = {
      outboundDials: setStDials, conversations: setStConversations,
      sets: setStSets, followUpsScheduled: setStFollowUps, improvementPlan: setStPlan,
    };
    Object.keys(next || {}).forEach(function(key) {
      if (setters[key]) setters[key](String(next[key]));
    });
  }

  function dmValues() {
    return {
      newLeads: dmNewLeads, conversations: dmConversations,
      followUpsScheduled: dmFollowUps, netNewCallsBooked: dmBooked,
      commonThemes: dmThemes,
    };
  }

  function applyDmDraft(next) {
    var setters = {
      newLeads: setDmNewLeads, conversations: setDmConversations,
      followUpsScheduled: setDmFollowUps, netNewCallsBooked: setDmBooked,
      commonThemes: setDmThemes,
    };
    Object.keys(next || {}).forEach(function(key) {
      if (setters[key]) setters[key](String(next[key]));
    });
  }

  useEffect(function() {
    var u = getUser();
    if (u) {
      setUser(u);
      setBcCloser(u.name);
      setCdCloser(u.name);
      setEodSalesRep(u.name);
      setAcCloser(u.name);
      setDmRep(u.name);
      setStRep(u.name);
    }
    setEodDate(toReportDay(new Date()));
    setDmDate(toReportDay(new Date()));
    setStDate(toReportDay(new Date()));

    apiFetch(withWorkspace('/api/dashboard', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.activity) setSubmissions(data.activity);
      })
      .catch(function() {});
  }, []);

  function clearBookCall() {
    setBcLeadsName(''); setBcLeadsPhone(''); setBcLeadsEmail('');
    setBcProgram(''); setBcQualified('yes'); setBcBookedDay(''); setBcBookedTime('');
    setBcSource(''); setBcTemperature(''); setBcGoal(''); setBcNotes('');
    setBcSetter(''); setBcCloser(user ? user.name : '');
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
    setEodDate(toReportDay(new Date()));
  }

  function clearAfterCall() {
    setAcLeadsName(''); setAcLeadsPhone(''); setAcLeadsEmail('');
    setAcOutcome(''); setAcNextStep(''); setAcNotes(''); setAcRecording('');
    setAcProgram(''); setAcDuration(''); setAcDealValue(''); setAcCash('');
    setAcPlatform(''); setAcOwnCard(''); setAcPayerName(''); setAcPayerEmail('');
    setAcPaymentType(''); setAcStructure(''); setAcFrequency('');
    setAcNextPayDate(''); setAcNextPayAmount(''); setAcRemaining('');
    setAcFollowupReason(''); setAcFollowupDate(''); setAcLostReason('');
    setAcCloser(user ? user.name : '');
  }

  function clearSetterEod() {
    setStDials(''); setStConversations(''); setStLiveCalls(''); setStTalkTime('');
    setStSets(''); setStFollowUps(''); setStCloses(''); setStCash('');
    setStCloser(''); setStRating(''); setStPlan('');
    setStLeadSource(''); setStObjection('');
    setStRep(user ? user.name : '');
    setStDate(toReportDay(new Date()));
  }

  function clearDmEod() {
    setDmNewLeads(''); setDmConversations(''); setDmBooked(''); setDmShowed('');
    setDmCloses(''); setDmCash(''); setDmGhosted(''); setDmReactivated('');
    setDmThemes(''); setDmBottleneck(''); setDmFollowUps(''); setDmObjections([]);
    setDmRep(user ? user.name : '');
    setDmDate(toReportDay(new Date()));
  }

  // On a phone this is the native share sheet, so a setter can push the calendar
  // straight into WhatsApp or iMessage instead of copying, leaving the app and
  // pasting. Everywhere else it is the clipboard, as before.
  function shareReport(link) {
    if (!link || !link.url) return;
    if (canShare) {
      navigator.share({ title: link.label, url: link.url }).catch(function() {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link.url);
      setCopiedReport(link.key);
      setTimeout(function() { setCopiedReport(''); }, 2000);
    }
  }

  function copyBookingLink() {
    if (!bookingLink || !bookingLink.url) return;
    if (canShare) {
      navigator.share({ title: bookingLink.label || 'Booking link', url: bookingLink.url })
        .catch(function() { /* dismissing the sheet is not an error */ });
      return;
    }
    try {
      navigator.clipboard.writeText(bookingLink.url);
      setCopiedLink(true);
      setTimeout(function() { setCopiedLink(false); }, 2000);
    } catch (e) {
      console.error('[Submit] Clipboard unavailable:', e.message);
    }
  }


  // The signed-in email identifies the person filing the form, which is only the
  // closer when they are filing for themselves. Sending it regardless credited a
  // manager with every deal they entered on a rep's behalf, and stamped that rep's
  // name onto the manager's own profile. A name that is not theirs carries no
  // email, and matches by name the way older records always have.
  function closerEmailFor(name) {
    if (!user || !user.email) return '';
    var typed = String(name || '').trim().toLowerCase();
    if (!typed) return user.email;
    var mine = String(user.name || '').trim().toLowerCase();
    var local = String(user.email).split('@')[0].replace(/[._-]+/g, ' ').toLowerCase();
    return (typed === mine || typed === local || typed === String(user.email).toLowerCase())
      ? user.email
      : '';
  }

  // The record saving and the message going out are two things, and the page used
  // to claim both whenever the first one worked. A rep who is told the group was
  // notified does not re-send; one who is told it failed goes and says it in chat.
  function filed(what, data) {
    var wa = (data && data.whatsapp) || {};
    if (wa.sent) return what + ' Sent to WhatsApp.';
    if (wa.skipped) return what + ' No WhatsApp destination is set, so nothing was sent.';
    return what + ' The WhatsApp message did NOT go out \u2014 tell the group yourself.';
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
          leadsName: bcLeadsName, leadsPhone: bcLeadsPhone, leadsEmail: bcLeadsEmail,
          program: bcProgram,
          qualified: bcQualified, bookedDay: bcBookedDay, bookedTime: bcBookedTime,
          // The two things the closer reads before they dial. `goal` and `notes`
          // are columns addBookedCall already carries, so neither needs `extra`.
          goal: bcGoal, notes: bcNotes,
          // The floor calls this Lead Temperature; the record and the WhatsApp
          // message have always called it Intent Score, under a thermometer.
          intentScore: bcTemperature,
          setter: bcSetter, closer: bcCloser, outboundInbound: bcSource,
          closerEmail: closerEmailFor(bcCloser),
          workspaceId: submitWorkspaceId,
          _whatsapp: waBC,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg(filed('Call booked.', data));
        setCelebrate({ variant: 'dart' });
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
          recordingUrl: cdRecording,
          paymentAgreement: cdPaymentAgreement, cashCollected: cdCashCollected,
          setter: cdSetter, closer: cdCloser, closerEmail: closerEmailFor(cdCloser),
          workspaceId: submitWorkspaceId,
          _whatsapp: waCD,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg(filed('Deal closed.', data));
        setCelebrate({ variant: 'cash', amount: cdCashCollected });
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
          // Chosen on the form rather than inferred from the numbers. A quiet day
          // with nothing on it used to fall through eodRole() to 'closer' by
          // default; now every report says which funnel it belongs to.
          position: 'Closer', role: 'closer',
          netNewCallsBooked: eodNetNew, callsOnCalendar: eodOnCalendar,
          callsTaken: eodTaken, callsNoShowed: eodNoShowed,
          callsCanceled: eodCanceled, callsRescheduled: eodRescheduled,
          callsTakenAndPitched: eodTakenPitched, closes: eodCloses,
          outboundDials: eodDials, cashCollectedMYFM: eodCashMYFM,
          cashCollectedI2I: eodCashI2I, revenueOnDay: eodRevenue,
          improvementPlan: eodPlan,
          closerEmail: closerEmailFor(eodSalesRep),
          workspaceId: submitWorkspaceId,
          _whatsapp: waEOD,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg(filed('EOD report submitted.', data));
        setCelebrate({ variant: 'eod', streak: data.streak || 0 });
        clearEOD();
        refreshActivity();
      } else { setError(data.error || 'Failed to submit'); }
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  async function handleSubmitAfterCall(evt) {
    evt.preventDefault();
    if (!acLeadsName.trim()) return;
    var kind = outcomeKind(acOutcome);
    setSubmitting(true); setError(''); setSuccessMsg(null);

    // Everything the outcome branch asked for, kept together so both records
    // carry the same account of the call. None of it needs a column of its own:
    // addAfterCallReport and addClosedDeal both pass `extra` through untouched,
    // and addClosedDeal is one of the functions the floor's numbers rest on.
    var detail = {
      program: acProgram,
      programDuration: acDuration,
      paymentPlatform: acPlatform,
      prospectPaidThemselves: acOwnCard,
      payerName: acOwnCard === 'No' ? acPayerName : '',
      payerEmail: acOwnCard === 'No' ? acPayerEmail : '',
      paymentType: acPaymentType,
      paymentStructure: acStructure,
      paymentFrequency: acFrequency,
      nextPaymentDate: acNextPayDate,
      nextPaymentAmount: acNextPayAmount,
      remainingPayments: acRemaining,
      followUpReason: acFollowupReason,
      followUpDate: acFollowupDate,
      lostReason: acLostReason,
      totalDealValue: acDealValue,
    };

    try {
      // The call itself, always. A closed call is still a call that happened, and
      // leaving it off this board would under-count every closer's calls taken.
      var res = await apiFetch('/api/webhooks/after-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingUrl: acRecording,
          leadsName: acLeadsName, leadsPhone: acLeadsPhone, leadsEmail: acLeadsEmail,
          closer: acCloser, outcome: acOutcome,
          nextStep: kind === 'follow-up' ? acFollowupReason : acNextStep,
          callNotes: acNotes,
          closerEmail: closerEmailFor(acCloser),
          extra: detail,
          workspaceId: submitWorkspaceId,
        }),
      });
      var data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to submit');
        setSubmitting(false);
        return;
      }

      // And the money, when there is money. Two records, never two sets of cash:
      // cash is read off closed deals, calls off after-call reports.
      if (kind === 'closed') {
        var waCD = getWhatsAppForType('close-deal');
        var deal = await apiFetch('/api/webhooks/close-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recordingUrl: acRecording,
            leadsName: acLeadsName, leadsPhone: acLeadsPhone, leadsEmail: acLeadsEmail,
            program: acProgram,
            cashCollected: acCash || acDealValue,
            paymentProcessor: acPlatform,
            paymentAgreement: acPaymentType,
            paymentDetails: acStructure,
            closer: acCloser, closerEmail: closerEmailFor(acCloser),
            notes: acNotes,
            extra: detail,
            workspaceId: submitWorkspaceId,
            _whatsapp: waCD,
          }),
        });
        var dealData = await deal.json();
        if (!dealData.success) {
          // The call is on the record; the deal is not. Say exactly that rather
          // than a success message that would leave the cash unaccounted for.
          setError('The call was filed, but the deal was not: '
            + (dealData.error || 'unknown error') + ' — file the deal again.');
          setSubmitting(false);
          return;
        }
        setSuccessMsg(filed('Deal closed and call filed.', dealData));
        setCelebrate({ variant: 'cash', amount: acCash || acDealValue });
      } else {
        setSuccessMsg(filed('End-of-call report submitted.', data));
        setCelebrate({ variant: 'aftercall' });
      }
      clearAfterCall();
      refreshActivity();
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  async function handleSubmitSetterEod(evt) {
    evt.preventDefault();
    if (!stRep.trim()) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var res = await apiFetch('/api/webhooks/eod-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRep: stRep, date: stDate,
          // Both, because two different readers ask. eodRole() reads `position`
          // to pick the board; buildEODMessage asks eodRole() too, which is how
          // this day goes out on the setter template instead of a closer's.
          position: 'Setter', role: 'setter',
          // Their wording on the left, the column that already holds it on the
          // right. Nothing is promoted out of the JSONB for this.
          outboundDials: stDials,            // Total Calls Made
          conversations: stConversations,    // Total People Reached
          followUpsScheduled: stFollowUps,   // Total Follow-Ups Made
          sets: stSets,                      // Total Calls Booked
          netNewCallsBooked: stSets,         // the same figure, under the name the setter KPI reads
          improvementPlan: stPlan,
          // No column of their own, and none is promoted for them — `extra` is
          // carried through addEODReport untouched.
          extra: { leadSourceWorked: stLeadSource, mainObjection: stObjection },
          closerEmail: closerEmailFor(stRep),
          workspaceId: submitWorkspaceId,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg(filed('Setter end-of-day submitted.', data));
        setCelebrate({ variant: 'eod', streak: data.streak || 0 });
        clearSetterEod();
        refreshActivity();
      } else { setError(data.error || 'Failed to submit'); }
    } catch (err) { setError('Connection error. Try again.'); }
    setSubmitting(false);
  }

  async function handleSubmitDmEod(evt) {
    evt.preventDefault();
    if (!dmRep.trim()) return;
    setSubmitting(true); setError(''); setSuccessMsg(null);
    try {
      var res = await apiFetch('/api/webhooks/eod-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesRep: dmRep, date: dmDate,
          // Said out loud rather than inferred. eodRole() never reclassifies a
          // report that names its own position, which matters here because a DM
          // setter reports closes they did not personally take.
          position: 'DM Setter',
          newLeads: dmNewLeads,              // Total New DMs / Conversations Started
          conversations: dmConversations,    // Total Replies / Conversations Had
          followUpsScheduled: dmFollowUps,   // Total Follow-Ups Sent
          netNewCallsBooked: dmBooked,       // Total Calls Booked
          commonThemes: dmThemes,
          // Several answers, kept as a list and joined for the message.
          extra: { mainObjections: dmObjections },
          closerEmail: closerEmailFor(dmRep),
          workspaceId: submitWorkspaceId,
        }),
      });
      var data = await res.json();
      if (data.success) {
        setSuccessMsg(filed('DM end-of-day submitted.', data));
        setCelebrate({ variant: 'dm', streak: data.streak || 0 });
        clearDmEod();
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
    { id: 'after-call', label: 'End-of-Call', icon: FileText, color: 'crm-accent' },
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

      <SubmitCelebration
        variant={celebrate && celebrate.variant}
        amount={celebrate && celebrate.amount}
        streak={celebrate && celebrate.streak}
        onDone={function() { setCelebrate(null); }}
      />

      <div className="px-8 py-8 space-y-6">

        {/* ===== ROUND ROBIN BOOKING LINK ===== */}
        {bookingLink && bookingLink.url && (
          <div className="glass-card book-card p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
              <CalendarDays className="w-5 h-5 text-crm-accent" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-semibold text-crm-text-bright">{bookingLink.label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
                  GoHighLevel
                </span>
              </div>
              <div className="text-xs text-crm-muted mt-1">{bookingLink.blurb}</div>
              <div className="book-url text-[11px] font-mono text-crm-muted mt-1.5 truncate md:truncate">{bookingLink.url}</div>
            </div>

            <div className="book-actions flex items-center gap-2 flex-shrink-0">
              <button onClick={copyBookingLink} className="btn-ghost flex items-center gap-2 text-xs">
                {copiedLink ? <Check className="w-3.5 h-3.5 text-crm-positive" />
                  : canShare ? <Share2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : (canShare ? 'Share link' : 'Copy link')}
              </button>
              <a
                href={bookingLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center gap-2 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open calendar
              </a>
            </div>
          </div>
        )}

        {/* A form with no destination refuses the write rather than filing a record
            nobody was told about, so this is the one thing that has to be set up
            before a rep can file. It is now counted from the forms this product
            ships, not from rows in a table, so a brand new workspace is warned too. */}
        {!hostedOnly && formsConfig && formsConfig.missingRoutes && formsConfig.missingRoutes.length > 0 && (
          <div className="sub-warn">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {formsConfig.missingRoutes.length} {formsConfig.missingRoutes.length === 1 ? 'form has' : 'forms have'} no
              destination set. {formsConfig.missingRoutes.length === 1 ? 'Submissions to it' : 'Submissions to them'} will be refused.
            </span>
            <button className="sub-warn-go" onClick={function() { router.push('/admin/workspace/forms'); }}>
              Fix it
            </button>
          </div>
        )}


        {/* The forms are the product now. Reps file every record type here, the
            WhatsApp message goes out from the server, and nothing outside this
            codebase has to be running for a rep to log a deal. */}
        <div className="space-y-6">

        {/* The forms this floor fills in somewhere else. Rendered above the tabs
            because for a workspace that uses them these ARE the forms — the tabs
            below are the same reports filed into the CRM instead. */}
        {reportLinks.map(function(link) {
          return (
            <div key={link.key} className="glass-card book-card p-5 flex flex-col md:flex-row md:items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                <FileText className="w-5 h-5 text-crm-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display font-semibold text-crm-text-bright">{link.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(var(--accent-rgb),0.10)', color: 'var(--crm-text-muted)' }}>
                    GoHighLevel
                  </span>
                </div>
                <div className="text-xs text-crm-muted mt-1">{link.blurb}</div>
                <div className="book-url text-[11px] font-mono text-crm-muted mt-1.5 truncate md:truncate">{link.url}</div>
              </div>
              <div className="book-actions flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={function() { shareReport(link); }}
                  className="btn-ghost flex items-center gap-2 text-xs">
                  {copiedReport === link.key ? <Check className="w-3.5 h-3.5 text-crm-positive" />
                    : canShare ? <Share2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedReport === link.key ? 'Copied' : (canShare ? 'Share link' : 'Copy link')}
                </button>
                <a href={link.url} target="_blank" rel="noopener noreferrer"
                  className="btn-primary flex items-center gap-2 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" /> Open the form
                </a>
              </div>
            </div>
          );
        })}

        {/* The CRM's own forms, for a workspace that files here. A workspace whose
            reports go to a hosted form sees the cards above instead, and this
            whole block with them — one place to file, so nothing is filed twice. */}
        {hostedOnly ? (
          <p className="sub-hosted">
            Reports are filed on the forms above.{' '}
            <button type="button" className="sub-hosted-show"
              onClick={function() { setShowInternal(true); }}>
              File in the CRM instead
            </button>
          </p>
        ) : null}

        {!hostedOnly && (
        <>
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
                  <label htmlFor="bc-email" className="form-label form-label-required">Lead&apos;s Email</label>
                  <input id="bc-email" type="email" value={bcLeadsEmail} required
                    onChange={function(e) { setBcLeadsEmail(e.target.value); }}
                    className="input-field" placeholder="prospect@email.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Lead&apos;s Phone</label>
                  <input type="text" value={bcLeadsPhone} onChange={function(e) { setBcLeadsPhone(e.target.value); }} className="input-field" placeholder="+1 555-123-4567" />
                </div>
              </div>
              {/* One question, the floor's own seven answers. The three-step brand
                  picker it replaces asked about offers this team does not sell and
                  could not name the ones it does. */}
              <div>
                <label htmlFor="bc-program" className="form-label form-label-required">Program/Service</label>
                <select id="bc-program" value={bcProgram} required
                  onChange={function(e) { setBcProgram(e.target.value); }} className="input-field">
                  <option value="">Select the offer</option>
                  {PROGRAMS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                </select>
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
                  <label htmlFor="bc-setter" className="form-label">Setter</label>
                  <RepPicker id="bc-setter" value={bcSetter} onChange={setBcSetter} reps={roster.reps} ready={roster.ready} placeholder="Who set it" />
                </div>
                <div>
                  <label htmlFor="bc-closer" className="form-label">Closer</label>
                  <RepPicker id="bc-closer" value={bcCloser} onChange={setBcCloser} reps={roster.reps} ready={roster.ready} placeholder="Who takes it" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  {/* Lands in `outboundInbound`, which every screen already labels
                      Source and whose filter builds its own list from what it finds
                      — so five real answers cost nothing downstream. */}
                  <label htmlFor="bc-source" className="form-label form-label-required">Booking Source</label>
                  <select id="bc-source" value={bcSource} required
                    onChange={function(e) { setBcSource(e.target.value); }} className="input-field">
                    <option value="">Where it came from</option>
                    {BOOKING_SOURCES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                  </select>
                </div>
                <div>
                  <label htmlFor="bc-temp" className="form-label form-label-required">Lead Temperature</label>
                  <select id="bc-temp" value={bcTemperature} required
                    onChange={function(e) { setBcTemperature(e.target.value); }} className="input-field">
                    <option value="">How warm are they</option>
                    {LEAD_TEMPERATURES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                  </select>
                </div>
              </div>

              <div className="form-section-title">For the closer</div>
              <div>
                <label htmlFor="bc-goal" className="form-label form-label-required">Main Goal / What do they need help with?</label>
                <input id="bc-goal" type="text" value={bcGoal} required
                  onChange={function(e) { setBcGoal(e.target.value); }}
                  className="input-field" placeholder="What they said they want fixed" />
              </div>
              <div>
                <label htmlFor="bc-notes" className="form-label form-label-required">Important Notes for the Closer</label>
                <textarea id="bc-notes" value={bcNotes} required
                  onChange={function(e) { setBcNotes(e.target.value); }}
                  className="input-field" rows={3}
                  placeholder="Anything the closer needs before they pick up the phone." />
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
                      <input type="number" inputMode="decimal" value={cdPricePoint} onChange={function(e) { setCdPricePoint(e.target.value); }} placeholder="e.g. 6000" className="input-field" />
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
                  <input type="number" inputMode="decimal" value={cdCashCollected} onChange={function(e) { setCdCashCollected(e.target.value); }} className="input-field" placeholder="5500" required />
                </div>
              </div>

              <div className="form-section-title">Team</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cd-setter" className="form-label">Setter</label>
                  <RepPicker id="cd-setter" value={cdSetter} onChange={setCdSetter} reps={roster.reps} ready={roster.ready} placeholder="Who set it" />
                </div>
                <div>
                  <label htmlFor="cd-closer" className="form-label">Closer</label>
                  <RepPicker id="cd-closer" value={cdCloser} onChange={setCdCloser} reps={roster.reps} ready={roster.ready} placeholder="Who closed it" />
                </div>
              </div>
              <div className="form-section-title">The recording</div>
              <div>
                <label htmlFor="cd-rec" className="form-label form-label-required">Link to the call recording</label>
                <input id="cd-rec" type="url" value={cdRecording}
                  onChange={function(e) { setCdRecording(e.target.value); }}
                  className="input-field" required
                  placeholder="https://fathom.video/share/… or Zoom, Grain, Drive…" />
                <p className="sub-note">
                  Required. Paste the share link from wherever the call was recorded — this is what makes
                  the deal auditable, so it cannot be filed without one.
                </p>
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
            <div className="eod-pick">
              <p className="eod-pick-q">Which end-of-day are you filing?</p>
              <p className="eod-pick-h">
                Three jobs, three reports. Pick yours and the right form opens — a
                setter filing on a closer&apos;s form answers six questions about calls
                they never took and never gets asked the numbers they did work on.
              </p>
              <div className="eod-pick-row">
                {EOD_KINDS.map(function(k) {
                  var mine = rosterKind && rosterKind === k.id;
                  return (
                    <button
                      key={k.id}
                      type="button"
                      aria-pressed={eodKind === k.id}
                      className={'eod-pick-opt' + (eodKind === k.id ? ' on' : '')}
                      onClick={function() { setEodKind(k.id); }}
                    >
                      <span className="eod-pick-l">{k.label}</span>
                      <span className="eod-pick-d">{k.blurb}</span>
                      {mine ? <span className="eod-pick-mine">your role</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {!eodKind ? (
              <p className="eod-pick-wait">Pick one above to open your end-of-day.</p>
            ) : null}

            {eodKind === 'closer' && (
            <form onSubmit={handleSubmitEOD} className="p-6 space-y-5">
              <EodAutofill
                role="closer"
                day={eodDate}
                rep={eodSalesRep}
                workspaceId={submitWorkspaceId}
                values={eodValues()}
                onApply={applyEodDraft}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="eod-rep" className="form-label form-label-required">Sales Rep</label>
                  <RepPicker id="eod-rep" value={eodSalesRep} onChange={setEodSalesRep} reps={roster.reps} ready={roster.ready} placeholder="Whose day this is" required />
                </div>
                <div>
                  <label htmlFor="eod-date" className="form-label">Date</label>
                  <input id="eod-date" type="date" value={eodDate} onChange={function(e) { setEodDate(e.target.value); }} className="input-field" />
                </div>
              </div>

              <div className="form-section-title">Call Metrics</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="eod-netnew" className="form-label">Net New Calls Booked</label>
                  <input id="eod-netnew" type="number" inputMode="numeric" value={eodNetNew} onChange={function(e) { setEodNetNew(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-oncal" className="form-label">Calls on Calendar</label>
                  <input id="eod-oncal" type="number" inputMode="numeric" value={eodOnCalendar} onChange={function(e) { setEodOnCalendar(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-taken" className="form-label">Calls Taken</label>
                  <input id="eod-taken" type="number" inputMode="numeric" value={eodTaken} onChange={function(e) { setEodTaken(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-noshow" className="form-label">No-Showed</label>
                  <input id="eod-noshow" type="number" inputMode="numeric" value={eodNoShowed} onChange={function(e) { setEodNoShowed(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-canceled" className="form-label">Canceled</label>
                  <input id="eod-canceled" type="number" inputMode="numeric" value={eodCanceled} onChange={function(e) { setEodCanceled(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-resched" className="form-label">Rescheduled</label>
                  <input id="eod-resched" type="number" inputMode="numeric" value={eodRescheduled} onChange={function(e) { setEodRescheduled(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Performance</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="eod-pitched" className="form-label">Calls Taken &amp; Pitched</label>
                  <input id="eod-pitched" type="number" inputMode="numeric" value={eodTakenPitched} onChange={function(e) { setEodTakenPitched(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-closes" className="form-label">Closes</label>
                  <input id="eod-closes" type="number" inputMode="numeric" value={eodCloses} onChange={function(e) { setEodCloses(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-dials" className="form-label">Outbound Dials</label>
                  <input id="eod-dials" type="number" inputMode="numeric" value={eodDials} onChange={function(e) { setEodDials(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Revenue</div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="eod-myfm" className="form-label">Cash Collected (MYFM)</label>
                  <input id="eod-myfm" type="number" inputMode="decimal" value={eodCashMYFM} onChange={function(e) { setEodCashMYFM(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-i2i" className="form-label">Cash Collected (I2I)</label>
                  <input id="eod-i2i" type="number" inputMode="decimal" value={eodCashI2I} onChange={function(e) { setEodCashI2I(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="eod-revenue" className="form-label">Revenue on Day</label>
                  <input id="eod-revenue" type="number" inputMode="decimal" value={eodRevenue} onChange={function(e) { setEodRevenue(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              <div className="form-section-title">Improvement Plan</div>
              <div>
                <label htmlFor="eod-plan" className="form-label">What will you improve?</label>
                <textarea id="eod-plan" value={eodPlan} onChange={function(e) { setEodPlan(e.target.value); }} className="input-field" rows={3} placeholder="What will you improve tomorrow? What worked today?" />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit EOD Report'}
              </button>
              <WhatsAppStatus formType="eod-report" />
            </form>
            )}

            {eodKind === 'setter' && (
            <form onSubmit={handleSubmitSetterEod} className="p-6 space-y-5">
              <EodAutofill
                role="setter"
                day={stDate}
                rep={stRep}
                workspaceId={submitWorkspaceId}
                values={setterValues()}
                onApply={applySetterDraft}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="st-rep" className="form-label form-label-required">Setter&apos;s Name</label>
                  <RepPicker id="st-rep" value={stRep} onChange={setStRep} reps={roster.reps} ready={roster.ready} placeholder="Whose day this is" required />
                </div>
                <div>
                  <label htmlFor="st-date" className="form-label form-label-required">Date Today</label>
                  <input id="st-date" type="date" value={stDate} required
                    onChange={function(e) { setStDate(e.target.value); }} className="input-field" />
                </div>
              </div>

              <div className="form-section-title">The phone</div>
              <div>
                <label htmlFor="st-source" className="form-label form-label-required">Lead Source / List Worked</label>
                <select id="st-source" value={stLeadSource} required
                  onChange={function(e) { setStLeadSource(e.target.value); }} className="input-field">
                  <option value="">Which list you worked</option>
                  {LEAD_SOURCES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="st-dials" className="form-label form-label-required">Total Calls Made</label>
                  <input id="st-dials" type="number" min="0" inputMode="numeric" value={stDials} required
                    onChange={function(e) { setStDials(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="st-conv" className="form-label form-label-required">Total People Reached</label>
                  <input id="st-conv" type="number" min="0" inputMode="numeric" value={stConversations} required
                    onChange={function(e) { setStConversations(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="st-follow" className="form-label form-label-required">Total Follow-Ups Made</label>
                  <input id="st-follow" type="number" min="0" inputMode="numeric" value={stFollowUps} required
                    onChange={function(e) { setStFollowUps(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>
              <div>
                <label htmlFor="st-objection" className="form-label form-label-required">Main Objection / Reason People Didn&rsquo;t Book</label>
                <select id="st-objection" value={stObjection} required
                  onChange={function(e) { setStObjection(e.target.value); }} className="input-field">
                  <option value="">What stopped them</option>
                  {PHONE_OBJECTIONS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                </select>
              </div>

              <div className="form-section-title">What it produced</div>
              <div>
                <label htmlFor="st-sets" className="form-label form-label-required">Total Calls Booked</label>
                <input id="st-sets" type="number" min="0" inputMode="numeric" value={stSets} required
                  onChange={function(e) { setStSets(e.target.value); }} className="input-field" placeholder="0" />
              </div>
              <div>
                <label htmlFor="st-plan" className="form-label">Any important notes / issues from today?</label>
                <textarea id="st-plan" value={stPlan}
                  onChange={function(e) { setStPlan(e.target.value); }}
                  className="input-field" rows={3}
                  placeholder="What got in the way today, and what would fix it tomorrow." />
              </div>

              <button type="submit" disabled={submitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit Setter End-of-Day'}
              </button>
              <WhatsAppStatus formType="eod-report" />
            </form>
            )}

            {eodKind === 'dm-setter' && (
            <form onSubmit={handleSubmitDmEod} className="p-6 space-y-5">
              <EodAutofill
                role="dm"
                day={dmDate}
                rep={dmRep}
                workspaceId={submitWorkspaceId}
                values={dmValues()}
                onApply={applyDmDraft}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dm-rep" className="form-label form-label-required">Setter&apos;s Name</label>
                  <RepPicker id="dm-rep" value={dmRep} onChange={setDmRep} reps={roster.reps} ready={roster.ready} placeholder="Whose day this is" required />
                </div>
                <div>
                  <label htmlFor="dm-date" className="form-label form-label-required">Date Today</label>
                  <input id="dm-date" type="date" value={dmDate} required
                    onChange={function(e) { setDmDate(e.target.value); }} className="input-field" />
                </div>
              </div>

              <div className="form-section-title">The inbox</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="dm-leads" className="form-label form-label-required">Total New DMs / Conversations Started</label>
                  <input id="dm-leads" type="number" min="0" inputMode="numeric" value={dmNewLeads} required
                    onChange={function(e) { setDmNewLeads(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="dm-follow" className="form-label form-label-required">Total Follow-Ups Sent</label>
                  <input id="dm-follow" type="number" min="0" inputMode="numeric" value={dmFollowUps} required
                    onChange={function(e) { setDmFollowUps(e.target.value); }} className="input-field" placeholder="0" />
                </div>
                <div>
                  <label htmlFor="dm-conv" className="form-label form-label-required">Total Replies / Conversations Had</label>
                  <input id="dm-conv" type="number" min="0" inputMode="numeric" value={dmConversations} required
                    onChange={function(e) { setDmConversations(e.target.value); }} className="input-field" placeholder="0" />
                </div>
              </div>

              {/* Their form takes several answers here, not one — a day in the
                  inbox rarely dies of a single objection. */}
              <div>
                <span className="form-label form-label-required">Main Objection / Reason People Didn&rsquo;t Book</span>
                <div className="obj-grid">
                  {DM_OBJECTIONS.map(function(x) {
                    var on = dmObjections.indexOf(x) !== -1;
                    return (
                      <button key={x} type="button"
                        aria-pressed={on}
                        className={'obj-chip' + (on ? ' on' : '')}
                        onClick={function() { toggleDmObjection(x); }}>
                        {x}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-section-title">What it produced</div>
              <div>
                <label htmlFor="dm-booked" className="form-label form-label-required">Total Calls Booked</label>
                <input id="dm-booked" type="number" min="0" inputMode="numeric" value={dmBooked} required
                  onChange={function(e) { setDmBooked(e.target.value); }} className="input-field" placeholder="0" />
              </div>
              <div>
                <label htmlFor="dm-notes" className="form-label">Any important notes / issues from today?</label>
                <textarea id="dm-notes" value={dmThemes}
                  onChange={function(e) { setDmThemes(e.target.value); }}
                  className="input-field" rows={3}
                  placeholder="What kept coming up, and anything that slowed you down." />
              </div>

              <button type="submit" disabled={submitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit DM End-of-Day'}
              </button>
              <WhatsAppStatus formType="eod-report" />
            </form>
            )}

          </div>
        )}

        {/* ===== AFTER-CALL REPORT ===== */}
        {/* ===== END-OF-CALL REPORT (closers) ===== */}
        {activeTab === 'after-call' && (
          <div className="glass-card overflow-hidden stagger-1">
            <div className="section-header">
              <h3><FileText className="w-4 h-4 text-crm-accent" /> End-of-Call Report</h3>
              <span className="section-tag">Sends to WhatsApp</span>
            </div>
            <form onSubmit={handleSubmitAfterCall} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ac-closer" className="form-label form-label-required">Closer&apos;s Name</label>
                  <RepPicker id="ac-closer" value={acCloser} onChange={setAcCloser} reps={roster.reps} ready={roster.ready} placeholder="Who took the call" required />
                </div>
                <div>
                  <label htmlFor="ac-name" className="form-label form-label-required">Prospect Name</label>
                  <input id="ac-name" type="text" value={acLeadsName} required
                    onChange={function(e) { setAcLeadsName(e.target.value); }}
                    className="input-field" placeholder="Enter prospect's full name" />
                </div>
                <div>
                  <label htmlFor="ac-email" className="form-label form-label-required">Prospect Email</label>
                  <input id="ac-email" type="email" value={acLeadsEmail} required
                    onChange={function(e) { setAcLeadsEmail(e.target.value); }}
                    className="input-field" placeholder="prospect-email@email.com" />
                </div>
                <div>
                  <label htmlFor="ac-phone" className="form-label">Prospect Phone</label>
                  <input id="ac-phone" type="tel" value={acLeadsPhone}
                    onChange={function(e) { setAcLeadsPhone(e.target.value); }}
                    className="input-field" placeholder="+1 555-123-4567" />
                </div>
                <div>
                  <label htmlFor="ac-program" className="form-label form-label-required">Program/Service</label>
                  <select id="ac-program" value={acProgram} required
                    onChange={function(e) { setAcProgram(e.target.value); }} className="input-field">
                    <option value="">Select the offer</option>
                    {PROGRAMS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                  </select>
                </div>
                <div>
                  <label htmlFor="ac-outcome" className="form-label form-label-required">Call Outcome</label>
                  <select id="ac-outcome" value={acOutcome} required
                    onChange={function(e) { setAcOutcome(e.target.value); }} className="input-field">
                    <option value="">How did it end</option>
                    {CALL_OUTCOMES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                  </select>
                </div>
              </div>

              {/* ---- 🟢 CLOSED ---- */}
              {outcomeKind(acOutcome) === 'closed' && (
                <>
                  <div className="form-section-title">The deal</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ac-duration" className="form-label form-label-required">Program Duration</label>
                      <select id="ac-duration" value={acDuration} required
                        onChange={function(e) { setAcDuration(e.target.value); }} className="input-field">
                        <option value="">How long</option>
                        {PROGRAM_DURATIONS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ac-platform" className="form-label form-label-required">Payment Platform Used</label>
                      <select id="ac-platform" value={acPlatform} required
                        onChange={function(e) { setAcPlatform(e.target.value); }} className="input-field">
                        <option value="">Where it was paid</option>
                        {PAYMENT_PLATFORMS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ac-value" className="form-label form-label-required">Total Deal Value</label>
                      <input id="ac-value" type="number" min="0" inputMode="decimal" value={acDealValue} required
                        onChange={function(e) { setAcDealValue(e.target.value); }}
                        className="input-field" placeholder="0" />
                    </div>
                    <div>
                      <label htmlFor="ac-cash" className="form-label">Cash Collected</label>
                      <input id="ac-cash" type="number" min="0" inputMode="decimal" value={acCash}
                        onChange={function(e) { setAcCash(e.target.value); }}
                        className="input-field" placeholder="0" />
                      <p className="sub-note">
                        What actually landed today. Left empty, the full deal value is counted —
                        this is the figure the board and every commission read.
                      </p>
                    </div>
                  </div>

                  <div className="form-section-title">Payment / cardholder information</div>
                  <div>
                    <label htmlFor="ac-owncard" className="form-label form-label-required">Did the prospect use their own payment method/card?</label>
                    <select id="ac-owncard" value={acOwnCard} required
                      onChange={function(e) { setAcOwnCard(e.target.value); }} className="input-field">
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  {/* Only asked when somebody else paid — their form hides these on Yes. */}
                  {acOwnCard === 'No' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="ac-payer" className="form-label form-label-required">Name of Person Who Paid / Cardholder Name</label>
                        <input id="ac-payer" type="text" value={acPayerName} required
                          onChange={function(e) { setAcPayerName(e.target.value); }} className="input-field" />
                      </div>
                      <div>
                        <label htmlFor="ac-payer-email" className="form-label form-label-required">Email of Person Who Paid / Cardholder</label>
                        <input id="ac-payer-email" type="email" value={acPayerEmail} required
                          onChange={function(e) { setAcPayerEmail(e.target.value); }} className="input-field" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="ac-paytype" className="form-label form-label-required">Payment Type</label>
                    <select id="ac-paytype" value={acPaymentType} required
                      onChange={function(e) { setAcPaymentType(e.target.value); }} className="input-field">
                      <option value="">Select</option>
                      {PAYMENT_TYPES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                    </select>
                  </div>

                  {/* ---- payment plan or custom ---- */}
                  {needsSchedule(acPaymentType) && (
                    <>
                      <div className="form-section-title">The schedule</div>
                      <div>
                        <label htmlFor="ac-structure" className="form-label form-label-required">Payment Structure</label>
                        <input id="ac-structure" type="text" value={acStructure} required
                          onChange={function(e) { setAcStructure(e.target.value); }}
                          className="input-field" placeholder="$1,000 today + 5 monthly payments of $500" />
                        <p className="sub-note">Example: $1,000 today + 5 monthly payments of $500</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <label htmlFor="ac-freq" className="form-label form-label-required">Payment Frequency</label>
                          <select id="ac-freq" value={acFrequency} required
                            onChange={function(e) { setAcFrequency(e.target.value); }} className="input-field">
                            <option value="">Select</option>
                            {PAYMENT_FREQUENCIES.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="ac-nextdate" className="form-label form-label-required">Next Payment Date</label>
                          <input id="ac-nextdate" type="date" value={acNextPayDate} required
                            onChange={function(e) { setAcNextPayDate(e.target.value); }} className="input-field" />
                        </div>
                        <div>
                          <label htmlFor="ac-nextamt" className="form-label form-label-required">Next Payment Amount</label>
                          <input id="ac-nextamt" type="number" min="0" inputMode="decimal" value={acNextPayAmount} required
                            onChange={function(e) { setAcNextPayAmount(e.target.value); }} className="input-field" placeholder="0" />
                        </div>
                        <div>
                          <label htmlFor="ac-remaining" className="form-label form-label-required">Number of Remaining Payments</label>
                          <input id="ac-remaining" type="number" min="0" inputMode="numeric" value={acRemaining} required
                            onChange={function(e) { setAcRemaining(e.target.value); }} className="input-field" placeholder="0" />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ---- 🟡 FOLLOW-UP ---- */}
              {outcomeKind(acOutcome) === 'follow-up' && (
                <>
                  <div className="form-section-title">The follow-up</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="ac-fureason" className="form-label form-label-required">Reason for Follow-Up</label>
                      <select id="ac-fureason" value={acFollowupReason} required
                        onChange={function(e) { setAcFollowupReason(e.target.value); }} className="input-field">
                        <option value="">What they said</option>
                        {FOLLOWUP_REASONS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="ac-fudate" className="form-label form-label-required">Follow-Up Date</label>
                      <input id="ac-fudate" type="date" value={acFollowupDate} required
                        onChange={function(e) { setAcFollowupDate(e.target.value); }} className="input-field" />
                    </div>
                  </div>
                </>
              )}

              {/* ---- 🔴 LOST ---- */}
              {outcomeKind(acOutcome) === 'lost' && (
                <div>
                  <label htmlFor="ac-lost" className="form-label form-label-required">Reason Lost</label>
                  <select id="ac-lost" value={acLostReason} required
                    onChange={function(e) { setAcLostReason(e.target.value); }} className="input-field">
                    <option value="">Why it did not close</option>
                    {LOST_REASONS.map(function(x) { return <option key={x} value={x}>{x}</option>; })}
                  </select>
                </div>
              )}

              <div className="form-section-title">The record</div>
              <div>
                <label htmlFor="ac-notes" className="form-label form-label-required">Additional Notes</label>
                <textarea id="ac-notes" value={acNotes} required
                  onChange={function(e) { setAcNotes(e.target.value); }}
                  className="input-field" rows={3}
                  placeholder="What they said, what they objected to, what you promised." />
              </div>
              <div>
                <label htmlFor="ac-rec" className="form-label form-label-required">Link to the call recording</label>
                <input id="ac-rec" type="url" value={acRecording} required
                  onChange={function(e) { setAcRecording(e.target.value); }}
                  className="input-field"
                  placeholder="https://fathom.video/share/… or Zoom, Grain, Drive…" />
                <p className="sub-note">
                  Required. Paste the share link from wherever the call was recorded — this is what
                  makes the report auditable, so it cannot be filed without one.
                </p>
              </div>

              <button type="submit" disabled={submitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-4 h-4" />}
                {submitting ? 'Submitting...'
                  : outcomeKind(acOutcome) === 'closed' ? 'Submit & Close the Deal'
                  : 'Submit End-of-Call Report'}
              </button>
              <WhatsAppStatus formType="after-call" />
            </form>
          </div>
        )}

        </>
        )}
        </div>


        {/* Recent Submissions */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-crm-muted" />
            <h3 className="text-sm font-mono text-crm-muted uppercase tracking-wider">Recent submissions</h3>
          </div>
          {submissions.length > 0 ? (
            <>
            {/* A four-column table squeezed into 390px is four unreadable
                columns. One card per submission below md, the table above it. */}
            <div className="sub-recent-cards">
              {submissions.slice(0, 15).map(function(s) {
                var badge = typeBadge[s.type] || typeBadge['eod-report'];
                return (
                  <div key={'c-' + s.id} className="sub-card">
                    <span className="sub-card-detail">{s.detail}</span>
                    <span className="sub-card-when">
                      {new Date(s.submittedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                    </span>
                    <span className="sub-card-rep">{s.closerName}</span>
                    <span className={'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium ' + badge.cls}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="glass-card overflow-hidden sub-recent-table">
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
            </>
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
