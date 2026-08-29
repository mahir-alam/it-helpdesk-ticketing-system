import { useState } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { Alert } from '../components/ui.jsx';

const DEMO = [
  { label: 'Admin', email: 'admin@helpdesk.local', password: 'Admin!2345' },
  { label: 'Technician', email: 'priya.nair@helpdesk.local', password: 'Passw0rd!' },
  { label: 'End-user', email: 'robert.tran@corp.local', password: 'Passw0rd!' },
];

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', name: '', department: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={location.state?.from?.pathname || '/'} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === 'login'
        ? await login(form.email, form.password)
        : await register({ email: form.email, password: form.password, name: form.name, department: form.department || undefined });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    nav(res.user.role === 'END_USER' ? '/portal' : '/workspace', { replace: true });
  }

  function quick(d) {
    setForm((f) => ({ ...f, email: d.email, password: d.password }));
    setMode('login');
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand">IT Help Desk</div>
        <p className="muted small">A simplified implementation of ServiceNow-style core Incident Management.</p>

        <div className="row mb">
          <button className={mode === 'login' ? '' : 'ghost'} onClick={() => setMode('login')}>
            Sign in
          </button>
          <button className={mode === 'register' ? '' : 'ghost'} onClick={() => setMode('register')}>
            Register
          </button>
        </div>

        <Alert kind="error">{error}</Alert>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <div className="field">
                <label>Full name</label>
                <input value={form.name} onChange={set('name')} required />
              </div>
              <div className="field">
                <label>Department (optional)</label>
                <input value={form.department} onChange={set('department')} />
              </div>
            </>
          )}
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} />
          </div>
          <button type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="mt">
          <div className="muted small mb">Demo accounts (seeded):</div>
          <div className="pill-row">
            {DEMO.map((d) => (
              <button key={d.label} className="ghost small" onClick={() => quick(d)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
