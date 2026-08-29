import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Loading, Alert } from '../../components/ui.jsx';

const TYPES = [
  'DESKTOP',
  'LAPTOP',
  'PRINTER',
  'VIDEO_CONFERENCING',
  'MOBILE_IOS',
  'MOBILE_ANDROID',
  'MDM_DEVICE',
  'NETWORK',
  'SERVER',
  'PERIPHERAL',
];

export default function Assets() {
  const [f, setF] = useState({ type: '', q: '', firmwareStale: false });
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (f.type) p.set('type', f.type);
    if (f.q) p.set('q', f.q);
    if (f.firmwareStale) p.set('firmwareStale', 'true');
    return p.toString();
  }, [f]);
  const { data, loading, error } = useApi(`/assets${qs ? `?${qs}` : ''}`);

  return (
    <div>
      <div className="topbar">
        <h1>Assets / CMDB</h1>
        <p className="muted">Configuration items with user, hierarchy and CI relationships. Printer fleet tracks driver &amp; firmware.</p>
      </div>

      <div className="filters">
        <div className="field">
          <label>Search</label>
          <input value={f.q} onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))} placeholder="tag, serial…" />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
            <option value="">Any</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <label className="row small" style={{ fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={f.firmwareStale}
              onChange={(e) => setF((s) => ({ ...s, firmwareStale: e.target.checked }))}
              style={{ width: 'auto' }}
            />{' '}
            Printers: firmware 180d+ stale
          </label>
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
                <th>Tag</th>
                <th>Name</th>
                <th>Type</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Firmware</th>
                <th>Tickets</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">
                    <Link to={`/workspace/assets/${a.id}`}>{a.assetTag}</Link>
                  </td>
                  <td>{a.name}</td>
                  <td className="small">{a.type.replace(/_/g, ' ')}</td>
                  <td>
                    <span className="badge status">{a.status.replace(/_/g, ' ').toLowerCase()}</span>
                  </td>
                  <td className="small">{a.assignedTo?.name ?? '—'}</td>
                  <td className="small">{a.firmwareVersion ?? '—'}</td>
                  <td>{a._count?.tickets ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
