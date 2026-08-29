import { useMemo, useState } from 'react';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';

export default function AuditLog() {
  const [f, setF] = useState({ entityType: '', action: '' });
  const qs = useMemo(() => {
    const p = new URLSearchParams({ pageSize: '150' });
    if (f.entityType) p.set('entityType', f.entityType);
    if (f.action) p.set('action', f.action);
    return p.toString();
  }, [f]);
  const { data, loading, error } = useApi(`/audit?${qs}`);

  return (
    <div>
      <div className="topbar">
        <h1>Audit log</h1>
        <p className="muted">Every status, priority and assignment change — who, what, when.</p>
      </div>
      <div className="filters">
        <div className="field">
          <label>Entity type</label>
          <select value={f.entityType} onChange={(e) => setF((s) => ({ ...s, entityType: e.target.value }))}>
            <option value="">Any</option>
            {['Ticket', 'ChangeRequest', 'ServiceRequest', 'Problem', 'Asset', 'User', 'KnowledgeArticle'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Action contains</label>
          <input value={f.action} onChange={(e) => setF((s) => ({ ...s, action: e.target.value }))} placeholder="STATUS_CHANGE" />
        </div>
      </div>
      <Alert kind="error">{error}</Alert>
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Change</th>
                <th>Actor</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((a) => (
                <tr key={a.id}>
                  <td className="nowrap muted small">{fmtDate(a.createdAt)}</td>
                  <td className="small">
                    {a.entityType}
                    <div className="muted">{a.entityId.slice(-6)}</div>
                  </td>
                  <td className="small">{a.action.replace(/_/g, ' ')}</td>
                  <td className="small">
                    {a.field ? `${a.field}: ${a.oldValue ?? '—'} → ${a.newValue ?? '—'}` : '—'}
                  </td>
                  <td className="small">{a.actor?.name || a.actorLabel || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
