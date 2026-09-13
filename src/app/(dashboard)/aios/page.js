'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Send, Plus, Trash2, Loader2, Wrench } from 'lucide-react';
import { useWorkspace, withWorkspace, apiFetch } from '@/lib/workspace-client';

// What people actually walk up to this page to ask. Shown only on an empty chat,
// because a wall of suggestions above a conversation is clutter.
var STARTERS = [
  'How did we do today?',
  'Where is the funnel leaking this week?',
  'Who closed the most this month?',
  'Are we up or down on last week?',
  'How clean is our EOD data right now?',
  'What is my close rate on offers?',
];

function Bubble({ message }) {
  var mine = message.role === 'user';
  return (
    <div className={'aios-row ' + (mine ? 'mine' : 'theirs')}>
      <div className={'aios-bubble ' + (mine ? 'mine' : 'theirs')}>
        {message.text.split('\n').map(function(line, i) {
          return <p key={i} className={line.trim() ? 'aios-line' : 'aios-gap'}>{line}</p>;
        })}
        {!mine && message.tools && message.tools.length ? (
          <div className="aios-tools">
            <Wrench className="w-3 h-3" />
            <span>{message.tools.join(' · ')}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AiosPage() {
  var workspaceId = useWorkspace();
  var s1 = useState([]), convos = s1[0], setConvos = s1[1];
  var s2 = useState(null), activeId = s2[0], setActiveId = s2[1];
  var s3 = useState([]), messages = s3[0], setMessages = s3[1];
  var s4 = useState(''), draft = s4[0], setDraft = s4[1];
  var s5 = useState(false), busy = s5[0], setBusy = s5[1];
  var s6 = useState(''), error = s6[0], setError = s6[1];
  var s7 = useState(null), remaining = s7[0], setRemaining = s7[1];
  var s8 = useState(false), locked = s8[0], setLocked = s8[1];
  var bottom = useRef(null);
  var router = useRouter();

  var loadList = useCallback(function() {
    if (!workspaceId) return;
    apiFetch(withWorkspace('/api/aios/conversations', workspaceId))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d) return;
        if (d.onboardingRequired) { setLocked(true); return; }
        if (d.conversations) setConvos(d.conversations);
      })
      .catch(function() { /* the page still works without the history rail */ });
  }, [workspaceId]);

  useEffect(function() { loadList(); }, [loadList]);

  useEffect(function() {
    if (bottom.current) bottom.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  function openConversation(id) {
    setActiveId(id);
    setError('');
    apiFetch('/api/aios/conversations/' + id)
      .then(function(r) { return r.json(); })
      .then(function(d) { setMessages((d && d.conversation && d.conversation.messages) || []); })
      .catch(function() { setMessages([]); });
  }

  function startNew() {
    setActiveId(null);
    setMessages([]);
    setError('');
  }

  function removeConversation(id, e) {
    e.stopPropagation();
    apiFetch('/api/aios/conversations/' + id, { method: 'DELETE' })
      .then(function() {
        if (id === activeId) startNew();
        loadList();
      })
      .catch(function() { setError('That conversation could not be deleted.'); });
  }

  function ask(text) {
    var question = String(text || draft).trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    setBusy(true);
    // The question goes up on screen immediately; the answer replaces the
    // thinking row when it lands.
    setMessages(function(prev) { return prev.concat([{ id: 'local_' + Date.now(), role: 'user', text: question }]); });

    apiFetch('/api/aios/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question, conversationId: activeId, workspace: workspaceId }),
    })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, d: d }; }); })
      .then(function(res) {
        if (!res.ok || !res.d || res.d.error) {
          if (res.d && res.d.onboardingRequired) { setLocked(true); return; }
          setError((res.d && res.d.error) || 'Summit AIOS could not answer that.');
          return;
        }
        setActiveId(res.d.conversationId);
        setMessages(function(prev) { return prev.concat([res.d.message]); });
        if (typeof res.d.remaining === 'number') setRemaining(res.d.remaining);
        loadList();
      })
      .catch(function() { setError('Summit AIOS could not be reached.'); })
      .finally(function() { setBusy(false); });
  }

  // Same shut door the leaderboard shows, for the same reason: a rep who has not
  // been handed their seats has nothing here worth reading yet.
  if (locked) {
    return (
      <div className="px-4 md:px-8 py-16 max-w-[560px] mx-auto text-center">
        <Sparkles className="w-7 h-7 mx-auto mb-3" style={{ color: 'var(--crm-accent)' }} />
        <h1 className="font-display text-xl font-bold" style={{ color: 'var(--crm-text-bright)' }}>
          Summit AIOS opens when your onboarding does
        </h1>
        <p className="text-sm mt-2" style={{ color: 'var(--crm-muted)' }}>
          Your own dashboard and the submit forms are open the whole time. This one waits until
          you have been handed your seats and walked through the comp plan.
        </p>
        <button className="an-btn mt-4" onClick={function() { router.push('/onboarding'); }}>
          Go to my onboarding
        </button>
      </div>
    );
  }

  return (
    <div className="aios-page">
      <aside className="aios-rail glass-card">
        <button type="button" className="aios-new" onClick={startNew}>
          <Plus className="w-4 h-4" />
          <span>New conversation</span>
        </button>
        <div className="aios-list">
          {convos.length === 0 ? (
            <p className="aios-empty-rail">Nothing asked yet.</p>
          ) : convos.map(function(c) {
            return (
              <div
                key={c.id}
                className={'aios-conv' + (c.id === activeId ? ' active' : '')}
                onClick={function() { openConversation(c.id); }}
              >
                <span className="aios-conv-t">{c.title}</span>
                <button type="button" className="aios-conv-x" onClick={function(e) { removeConversation(c.id, e); }} aria-label="Delete conversation">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="aios-main glass-card">
        <header className="aios-head">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-crm-accent" />
            <div>
              <h1 className="aios-title">Summit AIOS</h1>
              <p className="aios-sub">Ask the CRM anything about this floor&rsquo;s numbers.</p>
            </div>
          </div>
          {remaining !== null ? (
            <span className="aios-quota">{remaining} questions left today</span>
          ) : null}
        </header>

        <div className="aios-thread">
          {messages.length === 0 ? (
            <div className="aios-welcome">
              <p className="aios-welcome-t">Every answer here is looked up, not guessed.</p>
              <p className="aios-welcome-s">
                Summit AIOS reads the same engine the dashboards read, so a figure it quotes is the figure
                on the page. It shows which look-ups it ran under each answer.
              </p>
              <div className="aios-starters">
                {STARTERS.map(function(s) {
                  return (
                    <button key={s} type="button" className="aios-starter" onClick={function() { ask(s); }}>
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : messages.map(function(m) { return <Bubble key={m.id} message={m} />; })}

          {busy ? (
            <div className="aios-row theirs">
              <div className="aios-bubble theirs aios-thinking">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Looking it up&hellip;</span>
              </div>
            </div>
          ) : null}
          <div ref={bottom} />
        </div>

        {error ? <p className="aios-error">{error}</p> : null}

        <form
          className="aios-composer"
          onSubmit={function(e) { e.preventDefault(); ask(); }}
        >
          <input
            type="text"
            className="aios-input"
            placeholder="Ask about today, a rep, a range, the funnel&hellip;"
            value={draft}
            onChange={function(e) { setDraft(e.target.value); }}
            disabled={busy}
            maxLength={2000}
          />
          <button type="submit" className="aios-send" disabled={busy || !draft.trim()} aria-label="Ask">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
