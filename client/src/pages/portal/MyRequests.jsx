import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';

export default function MyRequests() {
  const { data, loading, error, reload } = useApi('/service-requests');

  async function cancel(id) {
    try {
      await api.post(`/service-requests/${id}/cancel`);
      reload();
    } catch (e) {
      alert(errText(e));
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar">
        <h1>My requests</h1>
      </div>
      <Alert kind="error">{error}</Alert>
      {data?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Item</th>
                <th>Status</th>
                <th>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="nowrap">{r.number}</td>
                  <td>{r.catalogItem?.name}</td>
                  <td>
                    <span className="badge status">{r.status.replace(/_/g, ' ').toLowerCase()}</span>
                  </td>
                  <td className="nowrap muted small">{fmtDate(r.createdAt)}</td>
                  <td className="right">
                    {!['FULFILLED', 'REJECTED', 'CANCELLED'].includes(r.status) && (
                      <button className="ghost small" onClick={() => cancel(r.id)}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card muted">No requests yet — try the service catalog.</div>
      )}
    </div>
  );
}
