import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errText } from '../../api/client.js';
import {
  useApi,
  Loading,
  Alert,
  PriorityBadge,
  StatusBadge,
  SlaBadge,
  fmtDate,
} from '../../components/ui.jsx';

function Csat({ ticket, onDone }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (ticket.csatRating) {
    return (
      <div className="card">
        <h3>Your feedback</h3>
        <p>
          You rated this <strong>{ticket.csatRating.score}/5</strong>.
        </p>
        {ticket.csatRating.comment && <p className="muted">“{ticket.csatRating.comment}”</p>}
      </div>
    );
  }

  async function submit() {
    if (!score) return setErr('Pick a rating from 1 to 5.');
    setBusy(true);
    try {
      await api.post(`/tickets/${ticket.id}/csat`, { score, comment: comment || undefined });
      onDone();
    } catch (e) {
      setErr(errText(e));
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h3>How did we do?</h3>
      <Alert kind="error">{err}</Alert>
      <div className="row mb">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={score === n ? '' : 'ghost'} onClick={() => setScore(n)}>
            {n}
          </button>
        ))}
      </div>
      <textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="mt" onClick={submit} disabled={busy}>
        Submit rating
      </button>
    </div>
  );
}

export default function PortalTicketDetail() {
  const { id } = useParams();
  const { data: ticket, loading, error, reload } = useApi(`/tickets/${id}`);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState(null);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!ticket) return null;

  async function addComment(e) {
    e.preventDefault();
    setPosting(true);
    setPostErr(null);
    try {
      await api.post(`/tickets/${ticket.id}/comments`, { body });
      setBody('');
      reload();
    } catch (err) {
      setPostErr(errText(err));
    } finally {
      setPosting(false);
    }
  }

  const publicComments = (ticket.comments || []).filter((c) => !c.isInternal);

  return (
    <div>
      <div className="topbar">
        <Link to="/portal/tickets" className="small">
          ← My tickets
        </Link>
        <h1>
          {ticket.number}: {ticket.title}
        </h1>
        <div className="pill-row">
          <PriorityBadge value={ticket.priority} />
          <StatusBadge value={ticket.status} />
          <SlaBadge value={ticket.slaStatus} />
          <span className="badge soft">{ticket.category}</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div className="stack">
          <div className="card">
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
          </div>

          <div className="card">
            <h3>Conversation</h3>
            {publicComments.length === 0 && <p className="muted">No updates yet.</p>}
            <ul className="timeline">
              {publicComments.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.author?.name || 'You'}</strong>{' '}
                    {c.author?.role && c.author.role !== 'END_USER' && <span className="badge soft">support</span>}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  <div className="when">{fmtDate(c.createdAt)}</div>
                </li>
              ))}
            </ul>
            <form onSubmit={addComment} className="mt">
              <Alert kind="error">{postErr}</Alert>
              <textarea
                placeholder="Add a reply or more detail…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              <button className="mt" disabled={posting || !body.trim()}>
                {posting ? 'Sending…' : 'Send'}
              </button>
            </form>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Details</h3>
            <dl className="kv">
              <dt>Reference</dt>
              <dd>{ticket.number}</dd>
              <dt>Opened</dt>
              <dd>{fmtDate(ticket.createdAt)}</dd>
              <dt>Impact</dt>
              <dd>{ticket.impact.replace(/_/g, ' ').toLowerCase()}</dd>
              <dt>Urgency</dt>
              <dd>{ticket.urgency.replace(/_/g, ' ').toLowerCase()}</dd>
              <dt>Assigned team</dt>
              <dd>{ticket.assignee ? 'IT Support' : 'Triage'}</dd>
              <dt>Resolve by</dt>
              <dd>{fmtDate(ticket.slaResolveDueAt)}</dd>
              {ticket.resolvedAt && (
                <>
                  <dt>Resolved</dt>
                  <dd>{fmtDate(ticket.resolvedAt)}</dd>
                </>
              )}
            </dl>
          </div>

          {['RESOLVED', 'CLOSED'].includes(ticket.status) && <Csat ticket={ticket} onDone={reload} />}
        </div>
      </div>
    </div>
  );
}
