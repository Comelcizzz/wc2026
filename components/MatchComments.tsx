'use client';
import { useEffect, useRef, useState } from 'react';
import { postJSON } from '@/lib/clientApi';
import { displayName } from '@/lib/flair';
import type { MatchComment } from '@/lib/types';

export default function MatchComments({
  matchId,
  identified,
}: {
  matchId: string;
  identified: boolean;
}) {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const r = await fetch(`/api/comments?matchId=${encodeURIComponent(matchId)}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.ok) setComments(d.comments || []);
    } catch {}
  }

  useEffect(() => {
    if (open) load();
    const i = setInterval(() => { if (open) load(); }, 15000);
    return () => clearInterval(i);
  }, [matchId, open]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    const r = await postJSON('/api/comments', { matchId, text: text.trim() });
    setSending(false);
    if (r.ok) {
      setText('');
      load();
    }
  }

  return (
    <div className="match-comments">
      <button type="button" className="match-comments-toggle" onClick={() => setOpen((o) => !o)}>
        💬 Comments {comments.length > 0 && `(${comments.length})`}
      </button>
      {open && (
        <div className="match-comments-body">
          <div className="match-comments-list">
            {comments.length === 0 ? (
              <p className="muted small">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div className="match-comment" key={c.id}>
                  <strong>{displayName(c.authorName)}</strong>
                  <span className="muted small">{formatTime(c.createdAt)}</span>
                  <p>{c.text}</p>
                </div>
              ))
            )}
          </div>
          {identified && (
            <div className="match-comments-input row">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="Write a comment..."
                maxLength={400}
              />
              <button className="btn btn-secondary btn-sm" onClick={send} disabled={sending || !text.trim()}>
                {sending ? '...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}
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
