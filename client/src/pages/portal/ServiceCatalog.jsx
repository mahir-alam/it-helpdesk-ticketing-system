import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert } from '../../components/ui.jsx';

export default function ServiceCatalog() {
  const { data, loading, error } = useApi('/catalog');
  const nav = useNavigate();
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  async function request(item) {
    setBusyId(item.id);
    setMsg(null);
    try {
      const { data: req } = await api.post('/service-requests', { catalogItemId: item.id });
      setMsg({ kind: 'success', text: `Request ${req.number} submitted (${req.status.replace(/_/g, ' ').toLowerCase()}).` });
      setTimeout(() => nav('/portal/requests'), 900);
    } catch (err) {
      setMsg({ kind: 'error', text: errText(err) });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Loading />;

  const groups = (data || []).reduce((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div>
      <div className="topbar">
        <h1>Service catalog</h1>
        <p className="muted">Request standard items and access. These follow an approval &amp; fulfilment workflow, separate from break-fix tickets.</p>
      </div>
      <Alert kind="error">{error}</Alert>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {Object.entries(groups).map(([cat, items]) => (
        <div key={cat} className="mb">
          <h3>{cat}</h3>
          <div className="cards">
            {items.map((i) => (
              <div key={i.id} className="card stat">
                <strong>{i.name}</strong>
                <span className="muted small">{i.description}</span>
                <span className="small muted">
                  {i.approvalRequired ? 'Requires approval' : 'Auto-approved'} · ~{i.fulfillmentSlaDays}d
                </span>
                <button className="small mt" disabled={busyId === i.id} onClick={() => request(i)}>
                  {busyId === i.id ? 'Requesting…' : 'Request'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
