import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  useApi,
  Loading,
  Alert,
  PriorityBadge,
  StatusBadge,
  SlaBadge,
  SourceBadge,
  fmtRelative,
} from '../../components/ui.jsx';

const EMPTY = { status: '', priority: '', category: '', source: '', q: '', mine: false, unassigned: false, breached: false };

export default function Queue() {
  const location = useLocation();
  // one-shot success banner passed via navigation state (e.g. after a delete)
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [f, setF] = useState(EMPTY);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ pageSize: '100', sort: 'createdAt', order: 'desc' });
    Object.entries(f).forEach(([k, v]) => {
      if (v === '' || v === false) return;
      p.set(k, String(v));
    });
    return p.toString();
  }, [f]);

  const { data, loading, error } = useApi(`/tickets?${qs}`);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <div>
      <div className="topbar spread">
        <h1>Ticket queue</h1>
        <span className="muted small">{data?.pagination?.total ?? '—'} matching</span>
      </div>

      {notice && (
        <Alert kind="success">
          <span className="spread">
            {notice}
            <button className="ghost small" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </span>
        </Alert>
      )}

      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input value={f.q} onChange={set('q')} placeholder="title, ref…" />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={f.status} onChange={set('status')}>
            <option value="">Any</option>
            {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Priority</label>
          <select value={f.priority} onChange={set('priority')}>
            <option value="">Any</option>
            {['P1', 'P2', 'P3', 'P4'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Source</label>
          <select value={f.source} onChange={set('source')}>
            <option value="">Any</option>
            <option value="USER_SUBMITTED">User</option>
            <option value="SYSTEM_GENERATED">System</option>
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <label className="row small" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={f.mine} onChange={set('mine')} style={{ width: 'auto' }} /> Assigned to me
          </label>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <label className="row small" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={f.unassigned} onChange={set('unassigned')} style={{ width: 'auto' }} /> Unassigned
          </label>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <label className="row small" style={{ fontWeight: 400 }}>
            <input type="checkbox" checked={f.breached} onChange={set('breached')} style={{ width: 'auto' }} /> SLA breached
          </label>
        </div>
        <button className="ghost" onClick={() => setF(EMPTY)}>
          Clear
        </button>
      </div>

      <Alert kind="error">{error}</Alert>
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title</th>
                <th>Pri</th>
                <th>Status</th>
                <th>SLA</th>
                <th>Requester</th>
                <th>Assignee</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">
                    <Link to={`/workspace/tickets/${t.id}`}>{t.number}</Link>
                  </td>
                  <td>
                    {t.title} <SourceBadge value={t.source} />
                    <div className="muted small">{t.category}</div>
                  </td>
                  <td>
                    <PriorityBadge value={t.priority} />
                  </td>
                  <td>
                    <StatusBadge value={t.status} />
                  </td>
                  <td>
                    <SlaBadge value={t.slaStatus} />
                  </td>
                  <td className="nowrap small">{t.requester?.name ?? t.externalSource ?? '—'}</td>
                  <td className="nowrap small">{t.assignee?.name ?? <span className="muted">unassigned</span>}</td>
                  <td className="nowrap muted small">{fmtRelative(t.createdAt)}</td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="loading-row">
                    No tickets match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
