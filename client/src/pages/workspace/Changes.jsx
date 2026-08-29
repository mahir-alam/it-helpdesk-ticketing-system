import { useState } from 'react';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const NEXT = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['SCHEDULED', 'IN_PROGRESS'],
  SCHEDULED: ['IN_PROGRESS', 'APPROVED'],
  IN_PROGRESS: ['COMPLETED', 'ROLLED_BACK'],
  REJECTED: ['DRAFT'],
  COMPLETED: [],
  ROLLED_BACK: [],
};
const RISK = ['LOW', 'MEDIUM', 'HIGH'];
const EMPTY = { title: '', description: '', riskLevel: 'MEDIUM', rollbackPlan: '' };

export default function Changes() {
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useApi('/changes');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const act = async (fn) => {
    setMsg(null);
    try {
      await fn();
      reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar spread">
        <div>
          <h1>Change requests</h1>
          <p className="muted">Planned changes tracked separately from incidents — risk, change window, approval, rollback plan.</p>
        </div>
        <button className="ghost" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : '+ New change'}
        </button>
      </div>
      <Alert kind="error">{error}</Alert>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {showForm && (
        <div className="card mb" style={{ maxWidth: 640 }}>
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Risk level</label>
              <select value={form.riskLevel} onChange={(e) => setForm((f) => ({ ...f, riskLevel: e.target.value }))}>
                {RISK.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Rollback plan</label>
            <textarea value={form.rollbackPlan} onChange={(e) => setForm((f) => ({ ...f, rollbackPlan: e.target.value }))} />
          </div>
          <button
            onClick={() =>
              act(async () => {
                await api.post('/changes', form);
                setForm(EMPTY);
                setShowForm(false);
              })
            }
          >
            Create draft
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Risk</th>
              <th>Status</th>
              <th>Window</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((c) => (
              <tr key={c.id}>
                <td className="nowrap">{c.number}</td>
                <td>
                  {c.title}
                  <div className="muted small">by {c.requestedBy?.name}</div>
                </td>
                <td>
                  <span className={`badge ${c.riskLevel === 'HIGH' ? 'p1' : c.riskLevel === 'MEDIUM' ? 'p2' : 'p4'}`}>
                    {c.riskLevel}
                  </span>
                </td>
                <td>
                  <span className="badge status">{c.status.replace(/_/g, ' ').toLowerCase()}</span>
                </td>
                <td className="nowrap muted small">
                  {c.changeWindowStart ? fmtDate(c.changeWindowStart) : '—'}
                </td>
                <td>
                  <div className="pill-row">
                    {(NEXT[c.status] || []).map((s) => {
                      const adminOnly = s === 'APPROVED' || s === 'REJECTED';
                      if (adminOnly && !isAdmin) return null;
                      return (
                        <button
                          key={s}
                          className="ghost small"
                          onClick={() => act(() => api.post(`/changes/${c.id}/transition`, { to: s }))}
                        >
                          {s.replace(/_/g, ' ').toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
