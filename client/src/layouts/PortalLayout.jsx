import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function PortalLayout() {
  const { user, logout, isStaff } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Help Desk
          <small>Self-service portal</small>
        </div>
        <nav>
          <NavLink to="/portal/new" className={({ isActive }) => (isActive ? 'active' : '')}>
            Submit a ticket
          </NavLink>
          <NavLink to="/portal/tickets" end className={({ isActive }) => (isActive ? 'active' : '')}>
            My tickets
          </NavLink>
          <NavLink to="/portal/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>
            Service catalog
          </NavLink>
          <NavLink to="/portal/requests" className={({ isActive }) => (isActive ? 'active' : '')}>
            My requests
          </NavLink>
          <NavLink to="/portal/knowledge" className={({ isActive }) => (isActive ? 'active' : '')}>
            Knowledge base
          </NavLink>
        </nav>
        <div className="userbox">
          <div>{user?.name}</div>
          <div className="muted small">{user?.email}</div>
          {isStaff && (
            <div className="mt">
              <Link to="/workspace" className="small">
                → Technician workspace
              </Link>
            </div>
          )}
          <button className="ghost small mt" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
