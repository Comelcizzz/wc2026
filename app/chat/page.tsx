'use client';
import { useEffect, useRef, useState } from 'react';
import { postJSON } from '@/lib/clientApi';
import { displayName } from '@/lib/flair';
import type { ChatMessage } from '@/lib/types';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [chatR, loginR] = await Promise.all([
        fetch('/api/chat', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/login', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (chatR.ok) setMessages(chatR.messages || []);
      setLoggedIn(!!loginR?.name);
    } catch {}
  }

  useEffect(() => {
    load();
    const i = setInterval(load, 8000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const r = await postJSON('/api/chat', { text: text.trim() });
    setSending(false);
    if (r.ok) {
      setText('');
      load();
    }
  }

  return (
    <div className="chat-page">
      <section className="picks-toolbar">
        <div className="picks-title-block">
          <div className="eyebrow">Community</div>
          <h1>Pool chat</h1>
          <p>Talk with everyone in the pool. Match-specific comments live on the picks page.</p>
        </div>
      </section>

      <div className="card chat-shell">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No messages yet. Be the first!</p>
          ) : (
            messages.map((m) => (
              <div className="chat-msg" key={m.id}>
                <div className="chat-msg-head">
                  <strong>{displayName(m.authorName)}</strong>
                  <span className="muted small">{formatTime(m.createdAt)}</span>
                </div>
                <p className="chat-msg-text">{m.text}</p>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {loggedIn ? (
          <div className="chat-input row">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Write a message..."
              maxLength={500}
            />
            <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()}>
              {sending ? '...' : 'Send'}
            </button>
          </div>
        ) : (
          <p className="muted small chat-login-hint">
            <a href="/picks">Log in</a> on the picks page to write in chat.
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
