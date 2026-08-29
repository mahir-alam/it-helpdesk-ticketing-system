import { Link, useParams } from 'react-router-dom';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';

export default function KnowledgeArticle() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/knowledge-base/${slug}`);

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;

  return (
    <div>
      <Link to="/portal/knowledge" className="small">
        ← All articles
      </Link>
      <div className="card mt" style={{ maxWidth: 760 }}>
        <h1>{data.title}</h1>
        <div className="muted small mb">
          {data.category} · updated {fmtDate(data.updatedAt)} · {data.viewCount} views
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>{data.body}</div>
        {data.problem && (
          <p className="muted small mt">Linked problem: {data.problem.number} — {data.problem.title}</p>
        )}
      </div>
    </div>
  );
}
