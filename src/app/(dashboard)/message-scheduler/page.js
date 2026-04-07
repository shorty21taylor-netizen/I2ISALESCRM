'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Plus, Send, Trash2, Play, MessageSquare, Users, User, Calendar, ToggleLeft, ToggleRight, Eye, X } from 'lucide-react';
import { getUser } from '@/lib/auth';

var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function MessageSchedulerPage() {
  var router = useRouter();
  var s1 = useState([]), messages = s1[0], setMessages = s1[1];
  var s2 = useState(false), showCreate = s2[0], setShowCreate = s2[1];
  var s3 = useState(null), schedulerStatus = s3[0], setSchedulerStatus = s3[1];
  var s4 = useState(null), actionResult = s4[0], setActionResult = s4[1];

  // Create form state
  var s10 = useState(''), title = s10[0], setTitle = s10[1];
  var s11 = useState(''), message = s11[0], setMessage = s11[1];
  var s12 = useState('group'), destination = s12[0], setDestination = s12[1];
  var s13 = useState(''), destId = s13[0], setDestId = s13[1];
  var s14 = useState('daily'), frequency = s14[0], setFrequency = s14[1];
  var s15 = useState(9), hour = s15[0], setHour = s15[1];
  var s16 = useState(0), minute = s16[0], setMinute = s16[1];
  var s17 = useState(1), dayOfWeek = s17[0], setDayOfWeek = s17[1];
  var s18 = useState(''), oneTimeDate = s18[0], setOneTimeDate = s18[1];
  var s19 = useState(false), includeWeekends = s19[0], setIncludeWeekends = s19[1];
  var s20 = useState(''), previewMsg = s20[0], setPreviewMsg = s20[1];

  useEffect(function() {
    var u = getUser();
    if (!u || u.email !== 'shorty21taylor@gmail.com') {
      router.push('/');
      return;
    }

    fetch('/api/scheduled-messages')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.success) setMessages(d.messages || []); })
      .catch(function() {});

    fetch('/api/scheduler')
      .then(function(r) { return r.json(); })
      .then(function(d) { if (d.success) setSchedulerStatus(d.scheduler); })
      .catch(function() {});
  }, [router]);

  function resetForm() {
    setTitle(''); setMessage(''); setDestination('group'); setDestId('');
    setFrequency('daily'); setHour(9); setMinute(0); setDayOfWeek(1);
    setOneTimeDate(''); setIncludeWeekends(false); setPreviewMsg('');
  }

  function showResult(msg, success) {
    setActionResult({ message: msg, success: success });
    setTimeout(function() { setActionResult(null); }, 4000);
  }

  function handleCreate() {
    if (!title.trim() || !message.trim()) return;
    fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        title: title,
        message: message,
        destination: destination,
        groupId: destination === 'group' ? destId : '',
        phone: destination === 'direct' ? destId : '',
        frequency: frequency,
        hour: hour,
        minute: minute,
        dayOfWeek: dayOfWeek,
        date: oneTimeDate,
        includeWeekends: includeWeekends,
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          setMessages(d.messages || []);
          setShowCreate(false);
          resetForm();
          showResult('Message scheduled!', true);
        }
      })
      .catch(function() { showResult('Error creating message', false); });
  }

  function handleDelete(id) {
    fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: id }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          setMessages(d.messages || []);
          showResult('Message deleted', true);
        }
      })
      .catch(function() {});
  }

  function handleToggle(id, enabled) {
    fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', id: id, enabled: enabled }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) {
          setMessages(messages.map(function(m) { return m.id === id ? Object.assign({}, m, { enabled: enabled }) : m; }));
        }
      })
      .catch(function() {});
  }

  function handleSendNow(msg) {
    fetch('/api/scheduled-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send', id: msg.id }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) showResult('Message sent!', true);
      })
      .catch(function() { showResult('Send failed', false); });
  }

  function handleRunBuiltIn(action) {
    fetch('/api/scheduler', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success) showResult(d.message || 'Sent!', true);
      })
      .catch(function() { showResult('Failed', false); });
  }

  function handlePreview() {
    var now = new Date();
    var text = message
      .replace(/\{date\}/g, now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      .replace(/\{day\}/g, now.toLocaleDateString('en-US', { weekday: 'long' }))
      .replace(/\{team_count\}/g, '5')
      .replace(/\{crmlink\}/g, 'https://your-crm.railway.app');
    setPreviewMsg(text);
  }

  function formatTime(h, m) {
    var period = h >= 12 ? 'PM' : 'AM';
    var displayH = h % 12 || 12;
    return displayH + ':' + String(m).padStart(2, '0') + ' ' + period;
  }

  function formatFreq(msg) {
    if (msg.frequency === 'daily') return 'Daily at ' + formatTime(msg.hour, msg.minute);
    if (msg.frequency === 'weekly') return DAYS[msg.dayOfWeek] + 's at ' + formatTime(msg.hour, msg.minute);
    if (msg.frequency === 'once') return msg.date + ' at ' + formatTime(msg.hour, msg.minute);
    return msg.frequency;
  }

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-crm-text-bright">Message Scheduler</h1>
          <p className="text-xs text-crm-muted font-mono mt-1">Schedule automated WhatsApp messages to your team</p>
        </div>
        <button
          onClick={function() { setShowCreate(!showCreate); }}
          className="btn-primary flex items-center gap-2"
        >
          {showCreate ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Message'}
        </button>
      </div>

      {/* Action result */}
      {actionResult && (
        <div className={'flex items-center gap-2 p-3 rounded-lg mb-4 ' + (actionResult.success ? 'bg-crm-positive/5 border border-crm-positive/20' : 'bg-crm-negative/5 border border-crm-negative/20')}>
          <span className={'text-xs font-mono ' + (actionResult.success ? 'text-crm-positive' : 'text-crm-negative')}>{actionResult.message}</span>
        </div>
      )}

      <div className="space-y-6">

        {/* ===== BUILT-IN SCHEDULES ===== */}
        <div className="glass-card overflow-hidden">
          <div className="section-header">
            <h3><Clock className="w-4 h-4 text-crm-accent" /> Built-in Schedules</h3>
            <span className="section-tag">{schedulerStatus && schedulerStatus.running ? 'Running' : 'Stopped'}</span>
          </div>
          <div className="p-5 space-y-3">
            {[
              { key: 'eodReminder', label: 'EOD Reminder', time: '8:00 PM', dest: 'Team Group', action: 'run-eod-reminder', desc: 'Reminds team to submit end-of-day reports with CRM link' },
              { key: 'morningDigest', label: 'Morning Call Digest', time: '6:00 AM', dest: 'Team Group', action: 'run-morning-digest', desc: 'Today\'s booked calls per closer' },
              { key: 'adminMorningReport', label: 'Admin Morning Report', time: '6:00 AM', dest: 'Admin DM', action: 'run-admin-report', desc: 'Yesterday\'s combined EOD + month-to-date breakdown' },
            ].map(function(task) {
              var sched = schedulerStatus && schedulerStatus.schedule ? schedulerStatus.schedule[task.key] : null;
              return (
                <div key={task.key} className="glass-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={'w-2 h-2 rounded-full flex-shrink-0 ' + (sched && sched.enabled ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-crm-text-bright">{task.label}</div>
                      <div className="text-xs text-crm-muted">{task.time} EST &middot; {task.dest} &middot; {task.desc}</div>
                      {sched && sched.lastRun && (
                        <div className="text-[10px] text-crm-muted/50 mt-0.5">Last: {new Date(sched.lastRun).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={function() { handleRunBuiltIn(task.action); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-crm-accent/10 text-crm-accent border border-crm-accent/20 hover:bg-crm-accent/20 transition-colors ml-5 sm:ml-0 self-start sm:self-center"
                  >
                    <Play className="w-3 h-3" /> Run Now
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ===== CREATE NEW MESSAGE ===== */}
        {showCreate && (
          <div className="glass-card-accent overflow-hidden">
            <div className="section-header">
              <h3><Plus className="w-4 h-4 text-crm-accent" /> Create Scheduled Message</h3>
            </div>
            <div className="p-5 space-y-4">

              <div>
                <label className="form-label">Title</label>
                <input value={title} onChange={function(e) { setTitle(e.target.value); }} placeholder="Monday Motivation" className="input-field" />
              </div>

              <div>
                <label className="form-label">Message</label>
                <textarea
                  value={message}
                  onChange={function(e) { setMessage(e.target.value); }}
                  placeholder="Rise and grind team! New week, new goals."
                  rows={4}
                  className="input-field"
                />
                <p className="text-[10px] text-crm-muted/50 mt-1">
                  Placeholders: {'{'}<span className="text-crm-accent">date</span>{'}'} {'{'}<span className="text-crm-accent">day</span>{'}'} {'{'}<span className="text-crm-accent">team_count</span>{'}'} {'{'}<span className="text-crm-accent">crmlink</span>{'}'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Send To</label>
                  <select value={destination} onChange={function(e) { setDestination(e.target.value); }} className="input-field">
                    <option value="group">WhatsApp Group</option>
                    <option value="direct">Direct Message</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">{destination === 'group' ? 'Group ID' : 'Phone Number'}</label>
                  <input
                    value={destId}
                    onChange={function(e) { setDestId(e.target.value); }}
                    placeholder={destination === 'group' ? '120363xxxxx@g.us' : '+1234567890'}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Frequency</label>
                  <select value={frequency} onChange={function(e) { setFrequency(e.target.value); }} className="input-field">
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="once">One-time</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Hour</label>
                  <select value={hour} onChange={function(e) { setHour(parseInt(e.target.value)); }} className="input-field">
                    {Array.from({ length: 24 }, function(_, i) { return i; }).map(function(h) {
                      var label = (h % 12 || 12) + ':00 ' + (h >= 12 ? 'PM' : 'AM');
                      return <option key={h} value={h}>{label}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="form-label">Minute</label>
                  <select value={minute} onChange={function(e) { setMinute(parseInt(e.target.value)); }} className="input-field">
                    {[0, 15, 30, 45].map(function(m) {
                      return <option key={m} value={m}>{String(m).padStart(2, '0')}</option>;
                    })}
                  </select>
                </div>
              </div>

              {frequency === 'weekly' && (
                <div>
                  <label className="form-label">Day of Week</label>
                  <select value={dayOfWeek} onChange={function(e) { setDayOfWeek(parseInt(e.target.value)); }} className="input-field">
                    {DAYS.map(function(d, i) { return <option key={i} value={i}>{d}</option>; })}
                  </select>
                </div>
              )}

              {frequency === 'once' && (
                <div>
                  <label className="form-label">Date</label>
                  <input type="date" value={oneTimeDate} onChange={function(e) { setOneTimeDate(e.target.value); }} className="input-field" />
                </div>
              )}

              {frequency === 'daily' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={includeWeekends} onChange={function(e) { setIncludeWeekends(e.target.checked); }} className="rounded border-crm-border" />
                  <span className="text-xs text-crm-muted">Include weekends</span>
                </label>
              )}

              {/* Preview */}
              {previewMsg && (
                <div className="glass-surface p-4 rounded-xl">
                  <div className="text-[10px] text-crm-muted uppercase tracking-wider mb-2">Message Preview</div>
                  <pre className="text-sm text-crm-text-bright whitespace-pre-wrap font-mono">{previewMsg}</pre>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button onClick={handlePreview} className="btn-ghost flex items-center gap-2 text-sm">
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Schedule Message
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== CUSTOM MESSAGES LIST ===== */}
        <div className="glass-card overflow-hidden">
          <div className="section-header">
            <h3><MessageSquare className="w-4 h-4 text-crm-accent" /> Custom Messages</h3>
            <span className="section-tag">{messages.length} scheduled</span>
          </div>
          <div className="p-5">
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-6 h-6 text-crm-muted mx-auto mb-2" />
                <p className="text-sm text-crm-muted">No custom messages yet</p>
                <p className="text-xs text-crm-muted/50 mt-1">Click &quot;New Message&quot; to create one</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(function(msg) {
                  return (
                    <div key={msg.id} className="glass-surface p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={'w-2 h-2 rounded-full ' + (msg.enabled ? 'bg-crm-positive' : 'bg-crm-muted/30')} />
                            <span className="text-sm font-medium text-crm-text-bright">{msg.title}</span>
                            <span className={'text-[10px] px-1.5 py-0.5 rounded font-mono ' + (msg.destination === 'group' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20')}>
                              {msg.destination === 'group' ? 'Group' : 'Direct'}
                            </span>
                          </div>
                          <p className="text-xs text-crm-muted font-mono truncate mb-1">{msg.message.substring(0, 100)}{msg.message.length > 100 ? '...' : ''}</p>
                          <div className="text-[10px] text-crm-muted/60">
                            {formatFreq(msg)}
                            {msg.lastRun ? ' \u00B7 Last sent: ' + msg.lastRun : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={function() { handleToggle(msg.id, !msg.enabled); }}
                            className="text-crm-muted hover:text-crm-text-bright transition-colors p-1"
                            title={msg.enabled ? 'Disable' : 'Enable'}
                          >
                            {msg.enabled ? <ToggleRight className="w-5 h-5 text-crm-positive" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={function() { handleSendNow(msg); }}
                            className="text-crm-muted hover:text-crm-accent transition-colors p-1"
                            title="Send Now"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={function() { handleDelete(msg.id); }}
                            className="text-crm-muted hover:text-crm-negative transition-colors p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
