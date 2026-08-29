import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, fmtRelative } from '../../components/ui.jsx';

export default function Problems() {
  const { data, loading, error, reload } = useApi('/problems');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function detect() {
    setBusy(true);
    setMsg(null);
    try {
      const { data: r } = await api.post('/problems/detect');
      setMsg({ kind: 'success', text: `Sweep complete — scanned ${r.scanned} tickets, ${r.newClusters} new cluster(s).` });
      reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar spread">
        <div>
          <h1>Problem management</h1>
          <p className="muted">Recurring incidents are auto-linked into a Problem when 3+ similar tickets arrive in a short window.</p>
        </div>
        <button className="ghost" onClick={detect} disabled={busy}>
          {busy ? 'Running…' : 'Run detection sweep'}
        </button>
      </div>
      <Alert kind="error">{error}</Alert>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Status</th>
              <th>Origin</th>
              <th>Linked tickets</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((p) => (
              <tr key={p.id}>
                <td className="nowrap">
                  <Link to={`/workspace/problems/${p.id}`}>{p.number}</Link>
                </td>
                <td>{p.title}</td>
                <td>
                  <span className="badge status">{p.status.replace(/_/g, ' ').toLowerCase()}</span>
                </td>
                <td>{p.autoDetected ? <span className="badge sys">auto-detected</span> : 'manual'}</td>
                <td>{p._count?.linkedTickets ?? 0}</td>
                <td className="nowrap muted small">{fmtRelative(p.createdAt)}</td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td colSpan={6} className="loading-row">
                  No problems recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
