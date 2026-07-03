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
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

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

  useEffect(() => {
    if (!identified) return;
    fetch('/api/login', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPlayerId(d?.id || null))
      .catch(() => {});
  }, [identified]);

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

  function startEdit(comment: MatchComment) {
    setEditingId(comment.id);
    setEditingText(comment.text);
  }

  async function saveEdit(commentId: string) {
    if (!editingText.trim()) return;
    setSending(true);
    const r = await fetch('/api/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, commentId, text: editingText.trim() }),
    }).then((x) => x.json());
    setSending(false);
    if (r.ok) {
      setEditingId(null);
      setEditingText('');
      load();
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('Delete this comment?')) return;
    setSending(true);
    const r = await fetch('/api/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, commentId }),
    }).then((x) => x.json());
    setSending(false);
    if (r.ok) load();
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
                  <div className="match-comment-head">
                    <strong>{displayName(c.authorName)}</strong>
                    <span className="muted small">{formatTime(c.createdAt)}</span>
                  </div>
                  {editingId === c.id ? (
                    <div className="match-comment-edit">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(c.id)}
                        maxLength={400}
                      />
                      <button className="btn btn-secondary btn-sm" disabled={sending || !editingText.trim()} onClick={() => saveEdit(c.id)}>
                        Save
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={sending} onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <p>{c.text}</p>
                  )}
                  {playerId === c.authorId && editingId !== c.id && (
                    <div className="match-comment-actions">
                      <button type="button" onClick={() => startEdit(c)}>Edit</button>
                      <button type="button" onClick={() => deleteComment(c.id)}>Delete</button>
                    </div>
                  )}
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
