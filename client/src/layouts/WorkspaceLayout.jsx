import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import Breadcrumb from '../components/Breadcrumb.jsx';

const link = ({ isActive }) => (isActive ? 'active' : '');

export default function WorkspaceLayout() {
  const { user, logout, isAdmin } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Help Desk
          <small>Technician workspace</small>
        </div>
        <nav>
          <NavLink to="/workspace/queue" className={link}>
            Ticket queue
          </NavLink>
          <NavLink to="/workspace/analytics" className={link}>
            Analytics
          </NavLink>

          <div className="section-label">ITSM</div>
          <NavLink to="/workspace/problems" className={link}>
            Problems
          </NavLink>
          <NavLink to="/workspace/changes" className={link}>
            Change requests
          </NavLink>
          <NavLink to="/workspace/service-requests" className={link}>
            Service requests
          </NavLink>

          <div className="section-label">CMDB & Knowledge</div>
          <NavLink to="/workspace/assets" className={link}>
            Assets
          </NavLink>
          <NavLink to="/workspace/knowledge" className={link}>
            Knowledge base
          </NavLink>

          {isAdmin && (
            <>
              <div className="section-label">Admin</div>
              <NavLink to="/workspace/users" className={link}>
                Users
              </NavLink>
              <NavLink to="/workspace/audit" className={link}>
                Audit log
              </NavLink>
            </>
          )}
        </nav>
        <div className="userbox">
          <div>
            {user?.name} <span className="badge soft">{user?.role}</span>
          </div>
          <div className="muted small">{user?.email}</div>
          <div className="mt">
            <Link to="/portal" className="small">
              → Self-service portal
            </Link>
          </div>
          <button className="ghost small mt" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Breadcrumb />
        <Outlet />
      </main>
    </div>
  );
}
