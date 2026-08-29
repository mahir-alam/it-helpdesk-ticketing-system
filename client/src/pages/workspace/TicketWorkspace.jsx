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
  SourceBadge,
  fmtDate,
} from '../../components/ui.jsx';
import { IMPACT_OPTIONS, URGENCY_OPTIONS, previewPriority } from '../../components/priority.js';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const ACTIONS = [
  'PASSWORD_RESET',
  'ACCOUNT_UNLOCK',
  'NETWORK_DIAGNOSTIC',
  'REMOTE_SESSION_STARTED',
  'REMOTE_SESSION_ENDED',
  'SOFTWARE_REINSTALL',
  'HARDWARE_SWAP',
  'ESCALATED',
  'NOTE',
];

export default function TicketWorkspace() {
  const { id } = useParams();
  const { data: t, loading, error, reload } = useApi(`/tickets/${id}`);
  const { data: audit, reload: reloadAudit } = useApi(`/tickets/${id}/audit`);
  const { data: techs } = useApi('/users/assignable');
  const [msg, setMsg] = useState(null);
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(true);
  const [rp, setRp] = useState({ impact: '', urgency: '', reason: '' });
  const [action, setAction] = useState({ actionType: 'NOTE', notes: '' });

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!t) return null;

  const refresh = () => {
    reload();
    reloadAudit();
  };
  const call = async (fn) => {
    setMsg(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  };

  const rpPreview = previewPriority(rp.impact || t.impact, rp.urgency || t.urgency);

  return (
    <div>
      <div className="topbar">
        <Link to="/workspace/queue" className="small">
          ← Queue
        </Link>
        <h1>
          {t.number}: {t.title}
        </h1>
        <div className="pill-row">
          <PriorityBadge value={t.priority} />
          <StatusBadge value={t.status} />
          <SlaBadge value={t.slaStatus} />
          <SourceBadge value={t.source} />
          <span className="badge soft">{t.category}</span>
          {t.problem && (
            <Link to={`/workspace/problems/${t.problem.id}`} className="badge sys">
              {t.problem.number}
            </Link>
          )}
        </div>
      </div>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        {/* ─── Left column ─── */}
        <div className="stack">
          <div className="card">
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>
            {t.externalSource && (
              <p className="muted small">
                Raised by <strong>{t.externalSource}</strong>
                {t.externalRef ? ` (ref ${t.externalRef})` : ''}
              </p>
            )}
          </div>

          <div className="card">
            <h3>SOP checklist</h3>
            {(t.checklistItems || []).length === 0 && <p className="muted">No checklist for this category.</p>}
            {(t.checklistItems || []).map((c) => (
              <div key={c.id} className={`checklist-item ${c.isDone ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={c.isDone}
                  onChange={(e) =>
                    call(() => api.patch(`/tickets/${t.id}/checklist/${c.id}`, { isDone: e.target.checked }))
                  }
                />
                <label>{c.label}</label>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Technician action panel</h3>
            <div className="row">
              <select
                value={action.actionType}
                onChange={(e) => setAction((a) => ({ ...a, actionType: e.target.value }))}
                style={{ maxWidth: 220 }}
              >
                {ACTIONS.map((a) => (
                  <option key={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <input
                placeholder="notes (optional)"
                value={action.notes}
                onChange={(e) => setAction((a) => ({ ...a, notes: e.target.value }))}
              />
              <button
                className="small"
                onClick={() =>
                  call(async () => {
                    await api.post(`/tickets/${t.id}/actions`, {
                      actionType: action.actionType.replace(/ /g, '_'),
                      notes: action.notes || undefined,
                    });
                    setAction({ actionType: 'NOTE', notes: '' });
                  })
                }
              >
                Log
              </button>
            </div>
            <ul className="timeline mt">
              {(t.technicianActions || []).map((a) => (
                <li key={a.id}>
                  <strong>{a.actionType.replace(/_/g, ' ')}</strong> — {a.technician?.name}
                  {a.notes && <div>{a.notes}</div>}
                  <div className="when">{fmtDate(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Conversation &amp; notes</h3>
            <ul className="timeline">
              {(t.comments || []).map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.author?.name}</strong>{' '}
                    {c.isInternal ? (
                      <span className="badge breach">internal</span>
                    ) : (
                      <span className="badge soft">public</span>
                    )}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
                  <div className="when">{fmtDate(c.createdAt)}</div>
                </li>
              ))}
            </ul>
            <div className="mt">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note…" />
              <div className="row mt">
                <label className="row small" style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                    style={{ width: 'auto' }}
                  />{' '}
                  Internal note (hidden from requester)
                </label>
                <button
                  className="small"
                  disabled={!comment.trim()}
                  onClick={() =>
                    call(async () => {
                      await api.post(`/tickets/${t.id}/comments`, { body: comment, isInternal: internal });
                      setComment('');
                    })
                  }
                >
                  Post
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Audit trail</h3>
            <ul className="timeline">
              {(audit || []).map((a) => (
                <li key={a.id} className={a.actorLabel?.startsWith('system') ? 'sys' : ''}>
                  <strong>{a.action.replace(/_/g, ' ')}</strong>
                  {a.field && (
                    <span className="muted small">
                      {' '}
                      · {a.field}: {a.oldValue ?? '—'} → {a.newValue ?? '—'}
                    </span>
                  )}
                  <div className="when">
                    {a.actor?.name || a.actorLabel || 'system'} · {fmtDate(a.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ─── Right column: controls ─── */}
        <div className="stack">
          <div className="card">
            <h3>Status</h3>
            <div className="pill-row">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  className={s === t.status ? 'small' : 'ghost small'}
                  onClick={() => call(() => api.patch(`/tickets/${t.id}`, { status: s }))}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Assignment</h3>
            <select
              value={t.assignee?.id ?? ''}
              onChange={(e) => call(() => api.post(`/tickets/${t.id}/assign`, { assigneeId: e.target.value || null }))}
            >
              <option value="">— unassigned —</option>
              {(techs || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.isOnCall ? '(on-call)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="card">
            <h3>Reprioritise</h3>
            <p className="muted small">Priority is recomputed from impact &amp; urgency — it cannot be set directly.</p>
            <div className="field">
              <label>Impact</label>
              <select value={rp.impact || t.impact} onChange={(e) => setRp((r) => ({ ...r, impact: e.target.value }))}>
                {IMPACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Urgency</label>
              <select value={rp.urgency || t.urgency} onChange={(e) => setRp((r) => ({ ...r, urgency: e.target.value }))}>
                {URGENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Reason</label>
              <input value={rp.reason} onChange={(e) => setRp((r) => ({ ...r, reason: e.target.value }))} />
            </div>
            <div className="row">
              <span className="muted small">New priority:</span> <PriorityBadge value={rpPreview} />
            </div>
            <button
              className="small mt"
              onClick={() =>
                call(async () => {
                  await api.post(`/tickets/${t.id}/reprioritize`, {
                    impact: rp.impact || t.impact,
                    urgency: rp.urgency || t.urgency,
                    reason: rp.reason || undefined,
                  });
                  setRp({ impact: '', urgency: '', reason: '' });
                })
              }
            >
              Apply
            </button>
          </div>

          <div className="card">
            <h3>Details</h3>
            <dl className="kv">
              <dt>Requester</dt>
              <dd>{t.requester?.name ?? t.externalSource ?? '—'}</dd>
              <dt>Opened</dt>
              <dd>{fmtDate(t.createdAt)}</dd>
              <dt>First response</dt>
              <dd>{fmtDate(t.firstRespondedAt)}</dd>
              <dt>Response due</dt>
              <dd>{fmtDate(t.slaResponseDueAt)}</dd>
              <dt>Resolve due</dt>
              <dd>{fmtDate(t.slaResolveDueAt)}</dd>
              <dt>Resolved</dt>
              <dd>{fmtDate(t.resolvedAt)}</dd>
              {t.csatRating && (
                <>
                  <dt>CSAT</dt>
                  <dd>{t.csatRating.score}/5</dd>
                </>
              )}
            </dl>
          </div>

          {(t.affectedAssets || []).length > 0 && (
            <div className="card">
              <h3>Affected assets</h3>
              {t.affectedAssets.map((a) => (
                <div key={a.asset.id}>
                  <Link to={`/workspace/assets/${a.asset.id}`}>{a.asset.assetTag}</Link> — {a.asset.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
