import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import { RequireAuth, RequireStaff, RequireAdmin } from './auth/guards.jsx';
import PortalLayout from './layouts/PortalLayout.jsx';
import WorkspaceLayout from './layouts/WorkspaceLayout.jsx';

import LoginPage from './pages/LoginPage.jsx';
import NewTicket from './pages/portal/NewTicket.jsx';
import MyTickets from './pages/portal/MyTickets.jsx';
import PortalTicketDetail from './pages/portal/PortalTicketDetail.jsx';
import ServiceCatalog from './pages/portal/ServiceCatalog.jsx';
import MyRequests from './pages/portal/MyRequests.jsx';
import KnowledgeBrowse from './pages/portal/KnowledgeBrowse.jsx';
import KnowledgeArticle from './pages/portal/KnowledgeArticle.jsx';

import Queue from './pages/workspace/Queue.jsx';
import TicketWorkspace from './pages/workspace/TicketWorkspace.jsx';
import Analytics from './pages/workspace/Analytics.jsx';
import Problems from './pages/workspace/Problems.jsx';
import ProblemDetail from './pages/workspace/ProblemDetail.jsx';
import Changes from './pages/workspace/Changes.jsx';
import ServiceRequests from './pages/workspace/ServiceRequests.jsx';
import Assets from './pages/workspace/Assets.jsx';
import AssetDetail from './pages/workspace/AssetDetail.jsx';
import KnowledgeAdmin from './pages/workspace/KnowledgeAdmin.jsx';
import Users from './pages/workspace/Users.jsx';
import AuditLog from './pages/workspace/AuditLog.jsx';

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'END_USER' ? '/portal' : '/workspace'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Self-service portal */}
      <Route
        path="/portal"
        element={
          <RequireAuth>
            <PortalLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="tickets" replace />} />
        <Route path="new" element={<NewTicket />} />
        <Route path="tickets" element={<MyTickets />} />
        <Route path="tickets/:id" element={<PortalTicketDetail />} />
        <Route path="catalog" element={<ServiceCatalog />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="knowledge" element={<KnowledgeBrowse />} />
        <Route path="knowledge/:slug" element={<KnowledgeArticle />} />
      </Route>

      {/* Technician / admin workspace */}
      <Route
        path="/workspace"
        element={
          <RequireStaff>
            <WorkspaceLayout />
          </RequireStaff>
        }
      >
        <Route index element={<Navigate to="queue" replace />} />
        <Route path="queue" element={<Queue />} />
        <Route path="tickets/:id" element={<TicketWorkspace />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="problems" element={<Problems />} />
        <Route path="problems/:id" element={<ProblemDetail />} />
        <Route path="changes" element={<Changes />} />
        <Route path="service-requests" element={<ServiceRequests />} />
        <Route path="assets" element={<Assets />} />
        <Route path="assets/:id" element={<AssetDetail />} />
        <Route path="knowledge" element={<KnowledgeAdmin />} />
        <Route
          path="users"
          element={
            <RequireAdmin>
              <Users />
            </RequireAdmin>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAdmin>
              <AuditLog />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
