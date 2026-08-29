import { useEffect, useState, useCallback } from 'react';
import { api, errText } from '../api/client.js';

export function PriorityBadge({ value }) {
  if (!value) return <span className="badge soft">—</span>;
  return <span className={`badge ${String(value).toLowerCase()}`}>{value}</span>;
}

export function StatusBadge({ value }) {
  return <span className={`badge ${String(value).toLowerCase()}`}>{String(value).replace('_', ' ')}</span>;
}

export function SlaBadge({ value }) {
  if (!value) return null;
  const breach = value.includes('BREACHED');
  return <span className={`badge ${breach ? 'breach' : 'ontrack'}`}>{value.replace(/_/g, ' ')}</span>;
}

export function SourceBadge({ value }) {
  if (value !== 'SYSTEM_GENERATED') return null;
  return <span className="badge sys">system</span>;
}

export function Alert({ kind = 'info', children }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function Loading({ label = 'Loading…' }) {
  return <div className="loading-row">{label}</div>;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function fmtRelative(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Simple data-fetching hook. Returns { data, error, loading, reload }. */
export function useApi(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(!skip);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(path);
      setData(res.data);
    } catch (err) {
      setError(errText(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    if (skip) return;
    reload();
  }, [reload, skip]);

  return { data, error, loading, reload, setData };
}
