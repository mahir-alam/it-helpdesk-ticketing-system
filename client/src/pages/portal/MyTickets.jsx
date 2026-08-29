import { Link } from 'react-router-dom';
import { useApi, Loading, Alert, PriorityBadge, StatusBadge, fmtRelative } from '../../components/ui.jsx';

export default function MyTickets() {
  const { data, loading, error } = useApi('/tickets?pageSize=100&sort=createdAt&order=desc');

  return (
    <div>
      <div className="topbar spread">
        <h1>My tickets</h1>
        <Link className="btn" to="/portal/new">
          + New ticket
        </Link>
      </div>
      <Alert kind="error">{error}</Alert>
      {loading ? (
        <Loading />
      ) : data?.items?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">
                    <Link to={`/portal/tickets/${t.id}`}>{t.number}</Link>
                  </td>
                  <td>{t.title}</td>
                  <td className="nowrap">{t.category}</td>
                  <td>
                    <PriorityBadge value={t.priority} />
                  </td>
                  <td>
                    <StatusBadge value={t.status} />
                  </td>
                  <td className="nowrap muted small">{fmtRelative(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card muted">You haven’t submitted any tickets yet.</div>
      )}
    </div>
  );
}
