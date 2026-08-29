import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, Loading, Alert } from '../../components/ui.jsx';

export default function KnowledgeBrowse() {
  const [q, setQ] = useState('');
  const path = q ? `/knowledge-base?q=${encodeURIComponent(q)}` : '/knowledge-base';
  const { data, loading, error } = useApi(path);

  return (
    <div>
      <div className="topbar">
        <h1>Knowledge base</h1>
        <p className="muted">Self-help articles for common issues.</p>
      </div>
      <div className="field" style={{ maxWidth: 420 }}>
        <input placeholder="Search articles…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Alert kind="error">{error}</Alert>
      {loading ? (
        <Loading />
      ) : (
        <div className="stack">
          {(data || []).map((a) => (
            <div key={a.id} className="card">
              <Link to={`/portal/knowledge/${a.slug}`}>
                <strong>{a.title}</strong>
              </Link>
              <div className="muted small mt">
                {a.category} · {a.keywords?.join(', ')}
              </div>
            </div>
          ))}
          {data && data.length === 0 && <div className="card muted">No articles found.</div>}
        </div>
      )}
    </div>
  );
}
