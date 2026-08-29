import { useState } from 'react';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert, fmtDate } from '../../components/ui.jsx';

const EMPTY = { title: '', category: '', body: '', keywords: '', published: true };

export default function KnowledgeAdmin() {
  const { data, loading, error, reload } = useApi('/knowledge-base');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);

  async function create() {
    setMsg(null);
    try {
      await api.post('/knowledge-base', {
        title: form.title,
        category: form.category,
        body: form.body,
        keywords: form.keywords
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        published: form.published,
      });
      setForm(EMPTY);
      setOpen(false);
      reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  }

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar spread">
        <h1>Knowledge base</h1>
        <button className="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : '+ New article'}
        </button>
      </div>
      <Alert kind="error">{error}</Alert>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {open && (
        <div className="card mb" style={{ maxWidth: 680 }}>
          <div className="field-row">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
            </div>
          </div>
          <div className="field">
            <label>Body</label>
            <textarea rows={8} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
          </div>
          <div className="field">
            <label>Keywords (comma-separated)</label>
            <input value={form.keywords} onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))} />
          </div>
          <button onClick={create}>Publish</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Published</th>
              <th>Views</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td className="small">{a.category}</td>
                <td>{a.published ? 'yes' : <span className="muted">draft</span>}</td>
                <td>{a.viewCount}</td>
                <td className="nowrap muted small">{fmtDate(a.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
