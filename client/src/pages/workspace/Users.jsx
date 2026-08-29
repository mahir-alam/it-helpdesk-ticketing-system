import { useState } from 'react';
import { api, errText } from '../../api/client.js';
import { useApi, Loading, Alert } from '../../components/ui.jsx';

const ROLES = ['END_USER', 'TECHNICIAN', 'ADMIN'];
const EMPTY = { name: '', email: '', password: '', role: 'END_USER', department: '' };

export default function Users() {
  const { data, loading, error, reload } = useApi('/users');
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);

  const patch = async (id, body) => {
    setMsg(null);
    try {
      await api.patch(`/users/${id}`, body);
      reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  };

  const create = async () => {
    setMsg(null);
    try {
      await api.post('/users', { ...form, department: form.department || undefined });
      setForm(EMPTY);
      setOpen(false);
      reload();
    } catch (e) {
      setMsg({ kind: 'error', text: errText(e) });
    }
  };

  if (loading) return <Loading />;

  return (
    <div>
      <div className="topbar spread">
        <h1>Users</h1>
        <button className="ghost" onClick={() => setOpen((o) => !o)}>
          {open ? 'Close' : '+ New user'}
        </button>
      </div>
      <Alert kind="error">{error}</Alert>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      {open && (
        <div className="card mb" style={{ maxWidth: 620 }}>
          <div className="field-row">
            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Password</label>
              <input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={create}>Create</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Role</th>
              <th>On-call</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="small">{u.email}</td>
                <td className="small">{u.department ?? '—'}</td>
                <td>
                  <select value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={u.isOnCall}
                    onChange={(e) => patch(u.id, { isOnCall: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={u.isActive}
                    onChange={(e) => patch(u.id, { isActive: e.target.checked })}
                    style={{ width: 'auto' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
