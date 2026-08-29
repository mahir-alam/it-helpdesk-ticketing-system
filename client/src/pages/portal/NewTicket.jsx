import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errText } from '../../api/client.js';
import { Alert, PriorityBadge, useApi } from '../../components/ui.jsx';
import {
  IMPACT_OPTIONS,
  URGENCY_OPTIONS,
  PRIORITY_LABEL,
  previewPriority,
} from '../../components/priority.js';

const CATEGORIES = [
  'Email',
  'VPN / Remote Access',
  'Active Directory',
  'Printing',
  'Hardware',
  'Software',
  'Network',
  'Telephony / VC',
  'Mobile / MDM',
  'Security',
  'Accounts / Onboarding',
  'Storage / File Share',
];

export default function NewTicket() {
  const nav = useNavigate();
  const { data: templates } = useApi('/ticket-templates');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Email',
    impact: '',
    urgency: '',
    templateId: '',
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const preview = useMemo(() => previewPriority(form.impact, form.urgency), [form.impact, form.urgency]);

  useEffect(() => {
    if (!form.templateId || !templates) return;
    const t = templates.find((x) => x.id === form.templateId);
    if (!t) return;
    setForm((f) => ({
      ...f,
      category: t.category,
      impact: t.defaultImpact,
      urgency: t.defaultUrgency,
      description: f.description || t.bodyTemplate,
    }));
  }, [form.templateId, templates]);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!form.impact || !form.urgency) return setError('Choose an impact and an urgency so priority can be calculated.');
    setBusy(true);
    try {
      const { data } = await api.post('/tickets', {
        title: form.title,
        description: form.description,
        category: form.category,
        impact: form.impact,
        urgency: form.urgency,
        templateId: form.templateId || undefined,
      });
      nav(`/portal/tickets/${data.id}`);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="topbar">
        <h1>Submit a ticket</h1>
        <p className="muted">
          Describe the problem and its impact. Priority (P1–P4) is calculated automatically from impact &amp; urgency —
          it is never chosen directly.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <Alert kind="error">{error}</Alert>
        <form onSubmit={submit}>
          {templates?.length > 0 && (
            <div className="field">
              <label>Start from a template (optional)</label>
              <select value={form.templateId} onChange={set('templateId')}>
                <option value="">— none —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={set('title')} required minLength={3} maxLength={200} />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea value={form.description} onChange={set('description')} required rows={6} />
          </div>

          <div className="field">
            <label>Category</label>
            <select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Impact — who is affected?</label>
              <select value={form.impact} onChange={set('impact')} required>
                <option value="">— select —</option>
                {IMPACT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Urgency — how badly is work blocked?</label>
              <select value={form.urgency} onChange={set('urgency')} required>
                <option value="">— select —</option>
                {URGENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="matrix-preview mb">
            {preview ? (
              <div className="row">
                <span className="muted small">Calculated priority:</span>
                <PriorityBadge value={preview} />
                <span className="small">{PRIORITY_LABEL[preview]}</span>
                {preview === 'P1' && (
                  <span className="small" style={{ color: 'var(--p1)' }}>
                    · on-call routing + real-time alert will be triggered
                  </span>
                )}
              </div>
            ) : (
              <span className="muted small">Select impact &amp; urgency to see the calculated priority.</span>
            )}
            <div className="muted small mt">The server recalculates and stores this value on submission.</div>
          </div>

          <button type="submit" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}
