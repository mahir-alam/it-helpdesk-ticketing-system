import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Purely presentational "you are here" trail derived from the URL. No state,
// no data fetching — it only reads the current pathname.
const LABELS = {
  portal: 'Self-service portal',
  workspace: 'Technician workspace',
  new: 'Submit a ticket',
  tickets: 'Tickets',
  catalog: 'Service catalog',
  requests: 'My requests',
  knowledge: 'Knowledge base',
  queue: 'Ticket queue',
  analytics: 'Analytics',
  problems: 'Problems',
  changes: 'Change requests',
  'service-requests': 'Service requests',
  assets: 'Assets',
  users: 'Users',
  audit: 'Audit log',
};

const titleize = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const looksLikeId = (s) => /^[a-z0-9]{16,}$/i.test(s) || /^\d+$/.test(s);

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    to: '/' + segments.slice(0, i + 1).join('/'),
    label: LABELS[seg] || (looksLikeId(seg) ? `#${seg.slice(-6)}` : titleize(seg)),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={c.to}>
          {i > 0 && <span className="sep">/</span>}
          {c.isLast ? (
            <span className="current" aria-current="page">
              {c.label}
            </span>
          ) : (
            <Link to={c.to}>{c.label}</Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
