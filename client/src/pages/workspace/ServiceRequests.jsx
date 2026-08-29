import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';

const NEXT = {
  SUBMITTED: ['PENDING_APPROVAL', 'IN_FULFILLMENT', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_FULFILLMENT', 'CANCELLED'],
  IN_FULFILLMENT: ['FULFILLED', 'CANCELLED'],
  REJECTED: [],
  FULFILLED: [],
  CANCELLED: [],
};

export default function ServiceRequests() {
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useApi('/service-requests');

  const act = async (id, to) => {
    try {
      await api.post(`/service-requests/${id}/transition`, { to });
      reload();
    } catch (e) {
      alert(errText(e));
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar">
        <h1>Service requests</h1>
        <p className="muted">Catalog requests with their own approval &amp; fulfilment workflow.</p>
      </div>
      <Alert kind="error">{error}</Alert>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Item</th>
              <th>Requester</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{r.number}</td>
                <td>{r.catalogItem?.name}</td>
                <td className="small">{r.requestedBy?.name}</td>
                <td>
                  <span className="badge status">{r.status.replace(/_/g, ' ').toLowerCase()}</span>
                </td>
                <td className="nowrap muted small">{fmtDate(r.createdAt)}</td>
                <td>
                  <div className="pill-row">
                    {(NEXT[r.status] || []).map((s) => {
                      if ((s === 'APPROVED' || s === 'REJECTED') && !isAdmin) return null;
                      return (
                        <button key={s} className="ghost small" onClick={() => act(r.id, s)}>
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
