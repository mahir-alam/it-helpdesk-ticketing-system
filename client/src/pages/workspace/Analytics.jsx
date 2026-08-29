import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useApi, Loading, Alert } from '../../components/ui.jsx';

const PRI_COLORS = { P1: '#dc2626', P2: '#ea580c', P3: '#2563eb', P4: '#64748b' };

function Stat({ label, value, sub }) {
  return (
    <div className="card stat">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

export default function Analytics() {
  const { data: o, loading, error } = useApi('/analytics/overview?days=45');
  const { data: trend } = useApi('/analytics/volume-trend?days=30');
  const { data: workload } = useApi('/analytics/technician-workload?days=45');

  if (loading) return <Loading />;
  if (error) return <Alert kind="error">{error}</Alert>;

  const catData = (o.byCategory || []).slice(0, 8).map((c) => ({ name: c.category, count: c.count }));
  const priData = Object.entries(o.byPriority || {}).map(([name, value]) => ({ name, value }));

  return (
    <div>
      <div className="topbar">
        <h1>Analytics</h1>
        <p className="muted">Last {o.rangeDays} days · {o.ticketsCreatedInRange} tickets created in range</p>
      </div>

      <div className="cards mb">
        <Stat label="Mean time to resolve" value={`${o.mttr.overallHours}h`} sub={`${o.mttr.sampleSize} resolved`} />
        <Stat label="SLA compliance" value={`${o.sla.compliancePct}%`} sub={`${o.sla.openBreaching} open & breaching`} />
        <Stat
          label="CSAT average"
          value={o.csat.average ?? '—'}
          sub={`${o.csat.responses} responses`}
        />
        <Stat label="Open tickets" value={(o.byStatus.OPEN || 0) + (o.byStatus.IN_PROGRESS || 0)} />
      </div>

      <div className="grid mb" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <h3>Ticket volume by category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={catData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Open by priority</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={priData} dataKey="value" nameKey="name" outerRadius={90} label>
                {priData.map((e) => (
                  <Cell key={e.name} fill={PRI_COLORS[e.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>MTTR by priority (hours)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={Object.entries(o.mttr.byPriority).map(([name, v]) => ({ name, hours: v }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {Object.keys(o.mttr.byPriority).map((k) => (
                  <Cell key={k} fill={PRI_COLORS[k] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>Created vs resolved (30d)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={(trend || []).map((d) => ({ ...d, date: d.date.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="created" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="resolved" stroke="#16a34a" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h3>Technician workload</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Technician</th>
                <th>Open assigned</th>
                <th>In progress</th>
                <th>Resolved (range)</th>
                <th>Avg resolve (h)</th>
              </tr>
            </thead>
            <tbody>
              {(workload || []).map((w) => (
                <tr key={w.technicianId}>
                  <td>
                    {w.name} {w.isOnCall && <span className="badge sys">on-call</span>}
                  </td>
                  <td>{w.openAssigned}</td>
                  <td>{w.inProgress}</td>
                  <td>{w.resolvedInRange}</td>
                  <td>{w.avgResolveHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
