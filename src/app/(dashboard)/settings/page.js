'use client';
import { useState, useEffect } from 'react';
import { Copy, Check, Users, Bot, MessageSquare, Save, Activity, Send, CheckCircle, AlertCircle, Clock, Play, Pause, RefreshCw, Webhook, Phone, Zap, FileText, Video, Sun, Moon } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { getFormConfig, saveFormConfig } from '@/lib/form-config';
import { getTheme, setTheme } from '@/lib/theme';

export default function SettingsPage() {
  var s1 = useState(null), copiedText = s1[0], setCopiedText = s1[1];
  var s2 = useState(null), config = s2[0], setConfig = s2[1];
  var s3 = useState(false), saved = s3[0], setSaved = s3[1];
  var s4 = useState(''), origin = s4[0], setOrigin = s4[1];
  var s5 = useState(null), liveStatus = s5[0], setLiveStatus = s5[1];
  var s6 = useState(null), schedulerStatus = s6[0], setSchedulerStatus = s6[1];
  var s7 = useState(null), waStatus = s7[0], setWaStatus = s7[1];
  var s8 = useState(null), actionResult = s8[0], setActionResult = s8[1];
  var s9 = useState(false), syncing = s9[0], setSyncing = s9[1];
  var s10 = useState('dark'), currentTheme = s10[0], setCurrentTheme = s10[1];
  var s11 = useState(false), savedConnection = s11[0], setSavedConnection = s11[1];
  var s12 = useState(false), savedNotifications = s12[0], setSavedNotifications = s12[1];
  var s13 = useState(false), savedScheduled = s13[0], setSavedScheduled = s13[1];

  useEffect(function() {
    setCurrentTheme(getTheme());
    var cfg = getFormConfig();
    setConfig(cfg);
    setOrigin(window.location.origin);

    fetch('/api/dashboard')
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setLiveStatus(data); })
      .catch(function() {});

    fetch('/api/scheduler')
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setSchedulerStatus(data.scheduler); })
      .catch(function() {});

    fetch('/api/whatsapp-config')
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.success) setWaStatus(data); })
      .catch(function() {});
  }, []);

  function handleCopy(text) {
    navigator.clipboard.writeText(text).then(function() {
      setCopiedText(text);
      setTimeout(function() { setCopiedText(null); }, 2000);
    });
  }

  function updateConfig(key, value) {
    var newConfig = {};
    var keys = Object.keys(config);
    for (var i = 0; i < keys.length; i++) {
      newConfig[keys[i]] = config[keys[i]];
    }
    newConfig[key] = value;
    setConfig(newConfig);
  }

  function handleSave() {
    saveFormConfig(config);
    setSaved(true);
    setTimeout(function() { setSaved(false); }, 2000);

    // Push to server
    syncToServer(config);
  }

  function saveSection(flagSetter) {
    // Always persist the FULL config so one section's save never wipes another
    saveFormConfig(config);
    syncToServer(config);
    flagSetter(true);
    setTimeout(function() { flagSetter(false); }, 2000);
  }

  function syncToServer(cfg) {
    setSyncing(true);
    fetch('/api/whatsapp-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg || config),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success) {
          setWaStatus({ configured: data.configured, hasApiUrl: !!(cfg || config).assistroApiUrl, hasApiKey: !!(cfg || config).assistroApiKey, hasGroupId: !!(cfg || config).whatsappGroupId, hasAdminGroupId: !!(cfg || config).adminGroupId });
        }
        setSyncing(false);
        // Refresh scheduler status
        fetch('/api/scheduler')
          .then(function(r) { return r.json(); })
          .then(function(data) { if (data.success) setSchedulerStatus(data.scheduler); })
          .catch(function() {});
      })
      .catch(function() { setSyncing(false); });
  }

  function testGroup(type, groupId) {
    if (!config.assistroApiUrl || !groupId) {
      setActionResult({ success: false, message: 'Enter the Assistro API URL and Group ID first' });
      setTimeout(function() { setActionResult(null); }, 4000);
      return;
    }
    var labels = { booked: '📞 BOOKED CALL', deal: '💰 CLOSED DEAL', eod: '📋 EOD REPORT' };
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistroApiUrl: config.assistroApiUrl,
        assistroApiKey: config.assistroApiKey,
        whatsappGroupId: groupId,
        message: '🧪 TEST — ' + labels[type] + ' notifications from Summit CRM are working! ✅',
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setActionResult({
          success: !!data.sent,
          message: data.sent ? ('✅ Test sent to ' + labels[type] + ' group!') : ('❌ Failed: ' + (data.error || data.reason || 'Unknown')),
        });
        setTimeout(function() { setActionResult(null); }, 4000);
      })
      .catch(function(e) {
        setActionResult({ success: false, message: '❌ ' + e.message });
        setTimeout(function() { setActionResult(null); }, 4000);
      });
  }

  function handleRunNow(endpoint, body) {
    setActionResult(null);
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setActionResult({ endpoint: endpoint, success: true, message: 'Sent successfully!' });
        setTimeout(function() { setActionResult(null); }, 4000);
      })
      .catch(function(e) {
        setActionResult({ endpoint: endpoint, success: false, message: e.message });
      });
  }

  // Fire a scheduled message NOW using the SAVED localStorage config — bypasses the
  // server-side scheduler state entirely so it works even if config wasn't pushed.
  function runSavedTask(taskType) {
    setActionResult(null);
    if (!config.assistroApiUrl) {
      setActionResult({ success: false, message: 'Save your Assistro API URL first' });
      setTimeout(function() { setActionResult(null); }, 4000);
      return;
    }

    var groupId = '';
    var phone = '';
    var message = '';
    var isDirect = false;

    if (taskType === 'eodReminder') {
      groupId = config.eodReminderGroupId || config.bookedCallGroupId || config.whatsappGroupId || '';
      message = '⏰ EOD REMINDER ⏰\n'
        + '═══════════════════════\n\n'
        + 'Team — time to submit your End of Day report!\n\n'
        + '👉 Log into Summit CRM → Submit → End of Day\n\n'
        + 'Don\'t forget:\n'
        + '📞 Net new calls booked\n'
        + '🗣️ Calls taken & pitched\n'
        + '🏆 Closes & cash collected\n'
        + '📱 Outbound dials\n'
        + '🔮 Your plan for tomorrow\n\n'
        + '💪 Get it in before you clock out!\n'
        + '═══════════════════════';
    } else if (taskType === 'morningDigest') {
      groupId = config.morningDigestGroupId || config.bookedCallGroupId || config.whatsappGroupId || '';
      message = '☀️ MORNING CALL DIGEST ☀️\n'
        + '═══════════════════════\n\n'
        + 'Good morning team! Here are today\'s booked calls.\n\n'
        + '👉 Check Summit CRM for the full list\n\n'
        + '🎯 Let\'s close some deals today!\n'
        + '═══════════════════════';
    } else if (taskType === 'adminMorningReport') {
      // Admin report sends to group (not DM) via /api/admin-morning-report
      var adminGid = config.adminMorningReportGroupId || config.adminGroupId || '';
      if (!adminGid) {
        setActionResult({ success: false, message: 'Save the Admin Report Group ID first' });
        setTimeout(function() { setActionResult(null); }, 4000);
        return;
      }
      fetch('/api/admin-morning-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: adminGid,
          assistroApiUrl: config.assistroApiUrl,
          assistroApiKey: config.assistroApiKey,
        }),
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          setActionResult({
            success: !!data.success,
            message: data.success ? 'Admin Report sent to group!' : ('Failed: ' + (data.error || 'Unknown')),
          });
          setTimeout(function() { setActionResult(null); }, 6000);
        })
        .catch(function(e) {
          setActionResult({ success: false, message: e.message });
          setTimeout(function() { setActionResult(null); }, 6000);
        });
      return;
    }

    if (!groupId) {
      setActionResult({ success: false, message: 'Save the Group ID for this task first' });
      setTimeout(function() { setActionResult(null); }, 4000);
      return;
    }

    var endpoint = '/api/notify';
    var payload = {
      assistroApiUrl: config.assistroApiUrl,
      assistroApiKey: config.assistroApiKey,
      message: message,
    };
    payload.whatsappGroupId = groupId;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setActionResult({
          success: !!data.sent,
          message: data.sent
            ? '✅ Sent!'
            : '❌ Failed (' + (data.status || '?') + '): ' + (data.error || data.reason || JSON.stringify(data.result || {}).substring(0, 150)),
        });
        setTimeout(function() { setActionResult(null); }, 6000);
      })
      .catch(function(e) {
        setActionResult({ success: false, message: '❌ ' + e.message });
        setTimeout(function() { setActionResult(null); }, 6000);
      });
  }

  if (!config) return null;

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-[1200px] mx-auto">
      <h1 className="font-display text-xl md:text-2xl font-bold text-crm-text-bright mb-4 md:mb-6">Settings</h1>

      <div className="space-y-6">

        {/* ===== THEME TOGGLE ===== */}
        <div className="glass-card overflow-hidden stagger-1">
          <div className="section-header">
            <h3>{currentTheme === 'dark' ? <Moon className="w-4 h-4 text-crm-accent" /> : <Sun className="w-4 h-4 text-crm-warning" />} Appearance</h3>
            <span className="section-tag">{currentTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-crm-text-bright">Theme</div>
                <div className="text-xs text-crm-muted mt-1">Switch between dark and light mode</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={function() { setTheme('light'); setCurrentTheme('light'); }}
                  className={'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all ' + (currentTheme === 'light' ? 'bg-crm-warning/15 text-crm-warning border border-crm-warning/30' : 'text-crm-muted border border-crm-border hover:text-crm-text')}
                >
                  <Sun className="w-3.5 h-3.5" /> Light
                </button>
                <button
                  onClick={function() { setTheme('dark'); setCurrentTheme('dark'); }}
                  className={'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all ' + (currentTheme === 'dark' ? 'bg-crm-accent/15 text-crm-accent border border-crm-accent/30' : 'text-crm-muted border border-crm-border hover:text-crm-text')}
                >
                  <Moon className="w-3.5 h-3.5" /> Dark
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ===== LIVE STATUS ===== */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3><Activity className="w-4 h-4 text-crm-positive" /> Live Data Status</h3>
            <span className="section-tag">{liveStatus ? 'Connected' : 'Loading...'}</span>
          </div>
          <div className="p-5">
            {liveStatus ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-text-bright">{liveStatus.counts.bookedCalls}</div>
                  <div className="text-xs text-crm-muted mt-1">Booked Calls</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-positive">{liveStatus.counts.closedDeals}</div>
                  <div className="text-xs text-crm-muted mt-1">Closed Deals</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-text-bright">{liveStatus.counts.eodReports}</div>
                  <div className="text-xs text-crm-muted mt-1">EOD Reports</div>
                </div>
                <div className="glass-surface p-3 text-center">
                  <div className="text-2xl font-display font-bold text-crm-accent">{liveStatus.overview.activeClosers}</div>
                  <div className="text-xs text-crm-muted mt-1">Active Closers</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-crm-muted text-center py-4">Connecting to server...</div>
            )}
            <p className="text-xs text-crm-muted/50 mt-3">Data is persisted to PostgreSQL. Dashboard polls every 30 seconds.</p>
          </div>
        </div>

        {/* ===== WHATSAPP CONNECTION ===== */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3><MessageSquare className="w-4 h-4 text-crm-positive" /> WhatsApp Connection</h3>
            <span className="section-tag">{waStatus && waStatus.configured ? 'Connected' : 'Setup needed'}</span>
          </div>
          <div className="p-5 space-y-5">
            <p className="text-xs text-crm-muted">Connect your Assistro WhatsApp API to send team notifications. Book a Call and Close a Deal submissions are sent to your WhatsApp group automatically.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Assistro API URL</label>
                <input
                  type="text"
                  value={config.assistroApiUrl}
                  onChange={function(e) { updateConfig('assistroApiUrl', e.target.value); }}
                  placeholder="https://api.assistro.ai/v1/messages"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Assistro API Key</label>
                <input
                  type="password"
                  value={config.assistroApiKey}
                  onChange={function(e) { updateConfig('assistroApiKey', e.target.value); }}
                  placeholder="Your API key"
                  className="input-field"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">WhatsApp Group ID</label>
                  <input
                    type="text"
                    value={config.whatsappGroupId}
                    onChange={function(e) { updateConfig('whatsappGroupId', e.target.value); }}
                    placeholder="Group ID for team notifications"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Admin Report Group ID</label>
                  <input
                    type="text"
                    value={config.adminGroupId}
                    onChange={function(e) { updateConfig('adminGroupId', e.target.value); }}
                    placeholder="120363xxxxx@g.us"
                    className="input-field"
                  />
                  <p className="text-[10px] text-crm-muted/50 mt-1">Create a private WhatsApp group (just you). Daily admin reports send here.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Timezone</label>
                <select
                  value={config.timezone}
                  onChange={function(e) { updateConfig('timezone', e.target.value); }}
                  className="input-field"
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">CRM URL (for links in messages)</label>
                <input
                  type="text"
                  value={config.crmUrl}
                  onChange={function(e) { updateConfig('crmUrl', e.target.value); }}
                  placeholder="https://your-app.railway.app"
                  className="input-field"
                />
              </div>
            </div>

            {/* Connection Status Indicators */}
            {waStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className={'glass-surface p-2 text-center ' + (waStatus.hasApiUrl ? 'border-crm-positive/20' : '')}>
                  <div className={'w-2 h-2 rounded-full mx-auto mb-1 ' + (waStatus.hasApiUrl ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <span className="text-[10px] text-crm-muted">API URL</span>
                </div>
                <div className={'glass-surface p-2 text-center ' + (waStatus.hasApiKey ? 'border-crm-positive/20' : '')}>
                  <div className={'w-2 h-2 rounded-full mx-auto mb-1 ' + (waStatus.hasApiKey ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <span className="text-[10px] text-crm-muted">API Key</span>
                </div>
                <div className={'glass-surface p-2 text-center ' + (waStatus.hasGroupId ? 'border-crm-positive/20' : '')}>
                  <div className={'w-2 h-2 rounded-full mx-auto mb-1 ' + (waStatus.hasGroupId ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <span className="text-[10px] text-crm-muted">Group ID</span>
                </div>
                <div className={'glass-surface p-2 text-center ' + (waStatus.hasAdminGroupId ? 'border-crm-positive/20' : '')}>
                  <div className={'w-2 h-2 rounded-full mx-auto mb-1 ' + (waStatus.hasAdminGroupId ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <span className="text-[10px] text-crm-muted">Admin Group</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              {savedConnection && <span className="text-xs font-mono text-crm-positive">✓ Saved</span>}
              <button onClick={function() { saveSection(setSavedConnection); }} className="btn-primary text-sm ml-auto flex items-center gap-2">
                <Save className="w-3.5 h-3.5" /> Save Connection
              </button>
            </div>
          </div>
        </div>

        {/* ===== FORM NOTIFICATIONS — INSTANT SEND ===== */}
        <div className="glass-card overflow-hidden stagger-2">
          <div className="section-header">
            <h3><MessageSquare className="w-4 h-4 text-crm-accent" /> Form Notifications</h3>
            <span className="section-tag">Instant</span>
          </div>
          <div className="p-5">
            <p className="text-xs text-crm-muted mb-5 font-mono">Each form sends to its own WhatsApp group the instant a closer hits submit.</p>

            <div className="space-y-4">

              {/* Booked Call */}
              <div className="glass-surface p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📞</span>
                    <span className="text-sm font-display font-semibold" style={{ color: 'var(--crm-text-bright)' }}>Booked Call Notifications</span>
                  </div>
                  <button
                    onClick={function() { updateConfig('bookedCallEnabled', !config.bookedCallEnabled); }}
                    className={'relative w-10 h-5 rounded-full transition-colors duration-300 ' + (config.bookedCallEnabled ? 'bg-crm-positive' : 'bg-crm-border')}
                  >
                    <div className={'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ' + (config.bookedCallEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Group ID</label>
                <input
                  type="text"
                  value={config.bookedCallGroupId}
                  onChange={function(e) { updateConfig('bookedCallGroupId', e.target.value); }}
                  placeholder="120363xxxxx@g.us"
                  className="input-field"
                />
              </div>

              {/* Closed Deal */}
              <div className="glass-surface p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💰</span>
                    <span className="text-sm font-display font-semibold" style={{ color: 'var(--crm-text-bright)' }}>Closed Deal Notifications</span>
                  </div>
                  <button
                    onClick={function() { updateConfig('closedDealEnabled', !config.closedDealEnabled); }}
                    className={'relative w-10 h-5 rounded-full transition-colors duration-300 ' + (config.closedDealEnabled ? 'bg-crm-positive' : 'bg-crm-border')}
                  >
                    <div className={'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ' + (config.closedDealEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Group ID</label>
                <input
                  type="text"
                  value={config.closedDealGroupId}
                  onChange={function(e) { updateConfig('closedDealGroupId', e.target.value); }}
                  placeholder="120363xxxxx@g.us"
                  className="input-field"
                />
              </div>

              {/* EOD Report */}
              <div className="glass-surface p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="text-sm font-display font-semibold" style={{ color: 'var(--crm-text-bright)' }}>EOD Report Notifications</span>
                  </div>
                  <button
                    onClick={function() { updateConfig('eodReportEnabled', !config.eodReportEnabled); }}
                    className={'relative w-10 h-5 rounded-full transition-colors duration-300 ' + (config.eodReportEnabled ? 'bg-crm-positive' : 'bg-crm-border')}
                  >
                    <div className={'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-300 ' + (config.eodReportEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Group ID</label>
                <input
                  type="text"
                  value={config.eodReportGroupId}
                  onChange={function(e) { updateConfig('eodReportGroupId', e.target.value); }}
                  placeholder="120363xxxxx@g.us"
                  className="input-field"
                />
              </div>

            </div>

            {/* Test buttons */}
            <div className="flex items-center gap-3 mt-5">
              <button onClick={function() { testGroup('booked', config.bookedCallGroupId); }} className="btn-ghost text-xs">📞 Test Booked</button>
              <button onClick={function() { testGroup('deal', config.closedDealGroupId); }} className="btn-ghost text-xs">💰 Test Deal</button>
              <button onClick={function() { testGroup('eod', config.eodReportGroupId); }} className="btn-ghost text-xs">📋 Test EOD</button>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              {savedNotifications && <span className="text-xs font-mono text-crm-positive">✓ Saved</span>}
              <button onClick={function() { saveSection(setSavedNotifications); }} className="btn-primary text-sm ml-auto flex items-center gap-2">
                <Save className="w-3.5 h-3.5" /> Save Notifications
              </button>
            </div>
          </div>
        </div>

        {/* ===== SCHEDULED MESSAGES ===== */}
        <div className="glass-card overflow-hidden stagger-3">
          <div className="section-header">
            <h3><Clock className="w-4 h-4 text-crm-accent" /> Scheduled Messages</h3>
            <span className="section-tag">{schedulerStatus && schedulerStatus.running ? 'Running' : 'Stopped'}</span>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-xs text-crm-muted">Automated WhatsApp messages sent on schedule. Skips weekends. Requires WhatsApp to be connected.</p>

            {/* EOD Reminder - 8 PM */}
            <div className="glass-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={'w-2 h-2 rounded-full ' + (config.eodReminderEnabled ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <div>
                    <div className="text-sm font-medium text-crm-text-bright">EOD Reminder</div>
                    <div className="text-xs text-crm-muted">8:00 PM EST &middot; Reminds team to submit end-of-day reports</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={function() { updateConfig('eodReminderEnabled', !config.eodReminderEnabled); }}
                    className={'px-3 py-1.5 rounded-lg text-xs font-mono transition-all ' + (config.eodReminderEnabled ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-white/5 text-crm-muted border border-crm-border')}
                  >
                    {config.eodReminderEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={function() { runSavedTask('eodReminder'); }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Run Now
                  </button>
                </div>
              </div>
              {schedulerStatus && schedulerStatus.schedule && schedulerStatus.schedule.eodReminder && schedulerStatus.schedule.eodReminder.lastRun && (
                <div className="text-[10px] text-crm-muted/50 mt-1">Last run: {new Date(schedulerStatus.schedule.eodReminder.lastRun).toLocaleString()}</div>
              )}
            </div>

            {/* Morning Call Digest - 6 AM */}
            <div className="glass-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={'w-2 h-2 rounded-full ' + (config.morningDigestEnabled ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <div>
                    <div className="text-sm font-medium text-crm-text-bright">Morning Call Digest</div>
                    <div className="text-xs text-crm-muted">6:00 AM EST &middot; Sends today&apos;s booked calls to team group</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={function() { updateConfig('morningDigestEnabled', !config.morningDigestEnabled); }}
                    className={'px-3 py-1.5 rounded-lg text-xs font-mono transition-all ' + (config.morningDigestEnabled ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-white/5 text-crm-muted border border-crm-border')}
                  >
                    {config.morningDigestEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={function() { runSavedTask('morningDigest'); }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Run Now
                  </button>
                </div>
              </div>
              {schedulerStatus && schedulerStatus.schedule && schedulerStatus.schedule.morningDigest && schedulerStatus.schedule.morningDigest.lastRun && (
                <div className="text-[10px] text-crm-muted/50 mt-1">Last run: {new Date(schedulerStatus.schedule.morningDigest.lastRun).toLocaleString()}</div>
              )}
            </div>

            {/* Admin Morning Report - 6 AM */}
            <div className="glass-surface p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={'w-2 h-2 rounded-full ' + (config.adminMorningReportEnabled ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                  <div>
                    <div className="text-sm font-medium text-crm-text-bright">Admin Morning Report</div>
                    <div className="text-xs text-crm-muted">6:00 AM EST &middot; Yesterday&apos;s EOD + MTD breakdown to admin DM</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={function() { updateConfig('adminMorningReportEnabled', !config.adminMorningReportEnabled); }}
                    className={'px-3 py-1.5 rounded-lg text-xs font-mono transition-all ' + (config.adminMorningReportEnabled ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-white/5 text-crm-muted border border-crm-border')}
                  >
                    {config.adminMorningReportEnabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={function() { runSavedTask('adminMorningReport'); }}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-mono bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors"
                  >
                    <Play className="w-3 h-3" /> Run Now
                  </button>
                </div>
              </div>
              {schedulerStatus && schedulerStatus.schedule && schedulerStatus.schedule.adminMorningReport && schedulerStatus.schedule.adminMorningReport.lastRun && (
                <div className="text-[10px] text-crm-muted/50 mt-1">Last run: {new Date(schedulerStatus.schedule.adminMorningReport.lastRun).toLocaleString()}</div>
              )}
            </div>

            {/* Per-destination overrides */}
            <div className="space-y-3 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">EOD Reminder Group ID</label>
                  <input
                    type="text"
                    value={config.eodReminderGroupId}
                    onChange={function(e) { updateConfig('eodReminderGroupId', e.target.value); }}
                    placeholder="Override default group for EOD"
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Morning Digest Group ID</label>
                  <input
                    type="text"
                    value={config.morningDigestGroupId}
                    onChange={function(e) { updateConfig('morningDigestGroupId', e.target.value); }}
                    placeholder="Override default group for digest"
                    className="input-field text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-mono text-crm-muted uppercase tracking-wider mb-2">Admin Report Group ID (override)</label>
                <input
                  type="text"
                  value={config.adminMorningReportGroupId || ''}
                  onChange={function(e) { updateConfig('adminMorningReportGroupId', e.target.value); }}
                  placeholder="Override group for admin morning report"
                  className="input-field text-xs"
                />
              </div>
              <p className="text-[10px] text-crm-muted/50">Leave blank to use the Admin Report Group ID from the Connection section above.</p>
            </div>

            {/* Action result */}
            {actionResult && (
              <div className={'flex items-center gap-2 p-3 rounded-lg ' + (actionResult.success ? 'bg-crm-positive/5 border border-crm-positive/20' : 'bg-crm-negative/5 border border-crm-negative/20')}>
                {actionResult.success ? <CheckCircle className="w-4 h-4 text-crm-positive" /> : <AlertCircle className="w-4 h-4 text-crm-negative" />}
                <span className={'text-xs font-mono ' + (actionResult.success ? 'text-crm-positive' : 'text-crm-negative')}>{actionResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: '0.5px solid var(--crm-divider)' }}>
              {savedScheduled && <span className="text-xs font-mono text-crm-positive">✓ Saved</span>}
              <button onClick={function() { saveSection(setSavedScheduled); }} className="btn-primary text-sm ml-auto flex items-center gap-2">
                <Save className="w-3.5 h-3.5" /> Save Schedule
              </button>
            </div>
          </div>
        </div>

        {/* ===== WEBHOOK ENDPOINTS ===== */}
        <div className="glass-card overflow-hidden stagger-4">
          <div className="section-header">
            <h3><Webhook className="w-4 h-4 text-crm-accent" /> API Endpoints</h3>
            <span className="section-tag">Reference</span>
          </div>
          <div className="p-5 space-y-2">
            {[
              { label: 'Book a Call', path: '/api/webhooks/book-call', method: 'POST' },
              { label: 'Close a Deal', path: '/api/webhooks/close-deal', method: 'POST' },
              { label: 'EOD Report', path: '/api/webhooks/eod-report', method: 'POST' },
              { label: 'Dashboard', path: '/api/dashboard', method: 'GET' },
              { label: 'WhatsApp Group', path: '/api/notify', method: 'POST' },
              { label: 'WhatsApp Direct', path: '/api/notify-direct', method: 'POST' },
              { label: 'Morning Digest', path: '/api/morning-digest', method: 'POST' },
              { label: 'Admin Morning Report', path: '/api/admin-morning-report', method: 'POST' },
              { label: 'Scheduled Messages', path: '/api/scheduled-messages', method: 'GET/POST' },
              { label: 'Scheduler', path: '/api/scheduler', method: 'GET/POST' },
              { label: 'Health', path: '/api/health', method: 'GET' },
            ].map(function(ep) {
              var fullUrl = origin + ep.path;
              return (
                <div key={ep.path} className="flex items-center gap-3 glass-surface p-3">
                  <span className={'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ' + (ep.method === 'GET' ? 'bg-crm-positive/10 text-crm-positive border border-crm-positive/20' : 'bg-crm-accent/10 text-crm-accent border border-crm-accent/20')}>{ep.method}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-crm-text-bright">{ep.label}</div>
                    <div className="text-xs font-mono text-crm-muted truncate">{fullUrl}</div>
                  </div>
                  <button onClick={function() { handleCopy(fullUrl); }} className="btn-ghost p-2">
                    {copiedText === fullUrl ? <Check className="w-4 h-4 text-crm-positive" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== INTEGRATIONS ===== */}
        <div className="glass-card overflow-hidden stagger-5">
          <div className="section-header">
            <h3>Integrations</h3>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: 'WhatsApp (Assistro)', icon: MessageSquare, status: waStatus && waStatus.configured ? 'connected' : 'pending', description: 'Team group + admin direct notifications' },
              { name: 'Fathom', icon: Video, status: 'pending', description: 'AI call recording and analysis' },
              { name: 'JustCall', icon: Phone, status: 'pending', description: 'VoIP dialer and call tracking' },
            ].map(function(intg) {
              return (
                <div key={intg.name} className="flex items-center gap-3 p-3 glass-surface">
                  <div className={'p-2 rounded-xl ' + (intg.status === 'connected' ? 'bg-crm-positive/10 text-crm-positive' : 'bg-white/5 text-crm-muted')}>
                    <intg.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-crm-text-bright">{intg.name}</div>
                    <div className="text-xs text-crm-muted">{intg.description}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {intg.status === 'connected' ? (
                      <>
                        <div className="glow-dot-green" />
                        <span className="text-xs font-mono text-crm-positive">Ready</span>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-crm-muted">Setup needed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== TEAM MANAGEMENT ===== */}
        <div className="glass-card overflow-hidden stagger-6">
          <div className="section-header">
            <h3>Team Management</h3>
            <span className="section-tag">{liveStatus ? liveStatus.overview.activeClosers : 0} active</span>
          </div>
          <div className="p-5 space-y-2">
            {liveStatus && liveStatus.closers && liveStatus.closers.length > 0 ? (
              liveStatus.closers.map(function(c) {
                return (
                  <div key={c.name} className="flex items-center gap-3 p-3 glass-surface">
                    <div className="avatar avatar-md text-crm-text">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-crm-text-bright">{c.name}</div>
                      <div className="text-xs text-crm-muted">{c.dials} dials &middot; {c.closes} closes &middot; ${c.cash.toLocaleString()} cash</div>
                    </div>
                    <span className="badge-positive">Active today</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Users className="w-5 h-5 text-crm-muted mx-auto mb-2" />
                <p className="text-sm text-crm-muted">No team members yet</p>
                <p className="text-xs text-crm-muted/50 mt-1">Closers appear when they submit forms</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== SAVE BUTTON ===== */}
        <div className="flex items-center gap-3">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {syncing ? 'Syncing...' : 'Save & Sync Configuration'}
          </button>
          {saved && (
            <span className="text-sm font-mono text-crm-positive stagger-1">Saved!</span>
          )}
        </div>

      </div>
    </div>
  );
}
