import { Link, useParams } from 'react-router-dom';
import { useApi, Loading, Alert, PriorityBadge, StatusBadge, fmtDate } from '../../components/ui.jsx';

export default function AssetDetail() {
  const { id } = useParams();
  const { data: a, loading, error } = useApi(`/assets/${id}`);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;
  if (!a) return null;

  const links = [
    ...(a.linksFrom || []).map((l) => ({ id: l.id, type: l.type, other: l.to })),
    ...(a.linksTo || []).map((l) => ({ id: l.id, type: l.type, other: l.from })),
  ];

  return (
    <div>
      <Link to="/workspace/assets" className="small">
        ← Assets
      </Link>
      <div className="topbar">
        <h1>
          {a.assetTag} — {a.name}
        </h1>
        <div className="pill-row">
          <span className="badge soft">{a.type.replace(/_/g, ' ')}</span>
          <span className="badge status">{a.status.replace(/_/g, ' ').toLowerCase()}</span>
          {a.mdmEnrolled && <span className="badge sys">MDM enrolled</span>}
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="card">
          <h3>Details</h3>
          <dl className="kv">
            <dt>Manufacturer</dt>
            <dd>{a.manufacturer ?? '—'}</dd>
            <dt>Model</dt>
            <dd>{a.model ?? '—'}</dd>
            <dt>Serial</dt>
            <dd>{a.serialNumber ?? '—'}</dd>
            <dt>Location</dt>
            <dd>{a.location ?? '—'}</dd>
            <dt>Assigned to</dt>
            <dd>{a.assignedTo?.name ?? '—'}</dd>
            <dt>OS version</dt>
            <dd>{a.osVersion ?? '—'}</dd>
            <dt>Driver</dt>
            <dd>{a.driverVersion ?? '—'}</dd>
            <dt>Firmware</dt>
            <dd>
              {a.firmwareVersion ?? '—'}
              {a.lastFirmwareUpdate ? ` (updated ${fmtDate(a.lastFirmwareUpdate)})` : ''}
            </dd>
            <dt>Warranty</dt>
            <dd>{fmtDate(a.warrantyExpiry)}</dd>
          </dl>
        </div>

        <div className="stack">
          <div className="card">
            <h3>CI relationships</h3>
            {a.parentAsset && (
              <div>
                Parent: <Link to={`/workspace/assets/${a.parentAsset.id}`}>{a.parentAsset.assetTag}</Link>
              </div>
            )}
            {(a.childAssets || []).map((c) => (
              <div key={c.id}>
                Child: <Link to={`/workspace/assets/${c.id}`}>{c.assetTag}</Link> — {c.name}
              </div>
            ))}
            {links.map((l) => (
              <div key={l.id}>
                <span className="badge soft">{l.type.replace(/_/g, ' ').toLowerCase()}</span>{' '}
                <Link to={`/workspace/assets/${l.other.id}`}>{l.other.assetTag}</Link>
              </div>
            ))}
            {!a.parentAsset && !a.childAssets?.length && !links.length && <p className="muted">No linked CIs.</p>}
          </div>

          <div className="card">
            <h3>Related tickets</h3>
            {(a.relatedTickets || []).length === 0 && <p className="muted">None.</p>}
            {(a.relatedTickets || []).map((t) => (
              <div key={t.id} className="row">
                <Link to={`/workspace/tickets/${t.id}`}>{t.number}</Link>
                <PriorityBadge value={t.priority} />
                <StatusBadge value={t.status} />
                <span className="small">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
