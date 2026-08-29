import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, PriorityBadge, StatusBadge, fmtDate } from '../../components/ui.jsx';

const STATUSES = ['OPEN', 'INVESTIGATING', 'KNOWN_ERROR', 'RESOLVED'];

export default function ProblemDetail() {
  const { id } = useParams();
  const { data: p, loading, error, reload } = useApi(`/problems/${id}`);
  const [form, setForm] = useState({ rootCause: '', workaround: '' });
  const [msg, setMsg] = useState(null);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!p) return null;

  const save = async (patch) => {
    setMsg(null);
    try {
      await api.patch(`/problems/${id}`, patch);
      reload();
      setMsg({ kind: 'success', text: 'Saved.' });
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  };

  return (
    <div>
      <Link to="/workspace/problems" className="small">
        ← Problems
      </Link>
      <div className="topbar">
        <h1>
          {p.number}: {p.title}
        </h1>
        <div className="pill-row">
          <StatusBadge value={p.status} />
          {p.autoDetected && <span className="badge sys">auto-detected</span>}
          <span className="badge soft">{p.category}</span>
        </div>
      </div>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <div className="stack">
          <div className="card">
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
            <p className="muted small">Keywords: {p.keywords?.join(', ') || '—'}</p>
          </div>

          <div className="card">
            <h3>Linked incidents ({p.linkedTickets?.length ?? 0})</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Title</th>
                    <th>Pri</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(p.linkedTickets || []).map((t) => (
                    <tr key={t.id}>
                      <td className="nowrap">
                        <Link to={`/workspace/tickets/${t.id}`}>{t.number}</Link>
                      </td>
                      <td>{t.title}</td>
                      <td>
                        <PriorityBadge value={t.priority} />
                      </td>
                      <td>
                        <StatusBadge value={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Root cause &amp; workaround</h3>
            <div className="field">
              <label>Root cause</label>
              <textarea
                defaultValue={p.rootCause || ''}
                onChange={(e) => setForm((f) => ({ ...f, rootCause: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Workaround</label>
              <textarea
                defaultValue={p.workaround || ''}
                onChange={(e) => setForm((f) => ({ ...f, workaround: e.target.value }))}
              />
            </div>
            <button className="small" onClick={() => save(form)}>
              Save
            </button>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Status</h3>
            <div className="pill-row">
              {STATUSES.map((s) => (
                <button key={s} className={s === p.status ? 'small' : 'ghost small'} onClick={() => save({ status: s })}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>Meta</h3>
            <dl className="kv">
              <dt>Created</dt>
              <dd>{fmtDate(p.createdAt)}</dd>
              <dt>Reported by</dt>
              <dd>{p.reportedBy?.name || 'system'}</dd>
              <dt>Resolved</dt>
              <dd>{fmtDate(p.resolvedAt)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
