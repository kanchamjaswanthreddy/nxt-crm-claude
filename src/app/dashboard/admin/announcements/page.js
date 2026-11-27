'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/context/UserContext';
import PageHeader from '@/components/ui/PageHeader';
import { fetchAnnouncements, saveAnnouncement, deleteAnnouncement } from '@/app/actions/announcements';
import st from './announcements.module.css';

const PHOTOS = [['', 'No picture (dark panel)'], ['our-vision', 'Road at sunrise'], ['our-mission', 'Family at home'], ['partnership', 'Handshake'], ['responsibility', 'Signing papers'], ['ownership', 'Advisor with team'], ['transparency', 'Reviewing with clients'], ['education', 'Training session'], ['commitment', 'Community volunteers'], ['trust', 'Family together']];
const BLANK = { id: '', label: '', title: '', text: '', ctaLabel: '', ctaHref: '', photo: '', active: true, order: 0, startsOn: '', endsOn: '' };

export default function AnnouncementsPage() {
  const { userProfile } = useUser();
  const isAdmin = userProfile?.is_owner || userProfile?.role === 'admin' || userProfile?.role === 'it_engineer';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(BLANK);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    const r = await fetchAnnouncements(true);
    if (r.success) setItems(r.announcements); else setMsg({ bad: true, text: r.error });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await saveAnnouncement(form);
    setBusy(false);
    if (r.success) { setMsg({ text: form.id ? 'Announcement saved.' : 'Announcement added. It now shows first on every dashboard.' }); setForm(BLANK); load(); }
    else setMsg({ bad: true, text: r.error });
  };
  const remove = async (id) => {
    const r = await deleteAnnouncement(id); setConfirmId(null);
    if (r.success) { setMsg({ text: 'Announcement deleted.' }); if (form.id === id) setForm(BLANK); load(); } else setMsg({ bad: true, text: r.error });
  };
  const today = new Date().toISOString().split('T')[0];
  const state = (a) => (!a.active ? 'Off' : a.startsOn && a.startsOn > today ? `Starts ${a.startsOn}` : a.endsOn && a.endsOn < today ? 'Ended' : 'Showing');

  if (!isAdmin) return <div className={st.page}><PageHeader title="Announcements" subtitle="Only owners and admins can manage announcements." /></div>;

  return (
    <div className={st.page}>
      <PageHeader title="Announcements" subtitle="Slides you add here appear first in the slideshow on every agent's dashboard." />
      {msg && <p className={st.msg} data-bad={msg.bad || undefined} role="status">{msg.text}</p>}

      <div className={st.grid}>
        <form className={st.card} onSubmit={submit}>
          <h2 className={st.h2}>{form.id ? 'Edit announcement' : 'New announcement'}</h2>

          <label className={st.field}><span>Small label above the headline</span>
            <input value={form.label} onChange={set('label')} maxLength={40} placeholder="For example: Event, Deadline, New carrier" /></label>
          <label className={st.field}><span>Headline (required)</span>
            <input value={form.title} onChange={set('title')} maxLength={110} required placeholder="For example: Year-end carrier deadlines" /></label>
          <label className={st.field}><span>Text</span>
            <textarea value={form.text} onChange={set('text')} maxLength={260} rows={3} placeholder="One or two sentences." /></label>

          <div className={st.two}>
            <label className={st.field}><span>Button text</span>
              <input value={form.ctaLabel} onChange={set('ctaLabel')} maxLength={30} placeholder="For example: See the dates" /></label>
            <label className={st.field}><span>Button link</span>
              <input value={form.ctaHref} onChange={set('ctaHref')} maxLength={300} placeholder="/dashboard/learn or https://..." /></label>
          </div>

          <label className={st.field}><span>Picture</span>
            <select value={form.photo} onChange={set('photo')}>{PHOTOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>

          <div className={st.three}>
            <label className={st.field}><span>Show from</span><input type="date" value={form.startsOn} onChange={set('startsOn')} /></label>
            <label className={st.field}><span>Show until</span><input type="date" value={form.endsOn} onChange={set('endsOn')} /></label>
            <label className={st.field}><span>Position (0 is first)</span><input type="number" min="0" max="999" value={form.order} onChange={set('order')} /></label>
          </div>

          <label className={st.check}><input type="checkbox" checked={form.active} onChange={set('active')} /> Show this announcement</label>

          <div className={st.actions}>
            <button type="submit" className={st.primary} disabled={busy}>{busy ? 'Saving' : form.id ? 'Save announcement' : 'Add announcement'}</button>
            {form.id && <button type="button" className={st.ghost} onClick={() => setForm(BLANK)}>Cancel edit</button>}
          </div>
        </form>

        <section className={st.card}>
          <h2 className={st.h2}>Preview</h2>
          <div className={st.preview} style={form.photo ? { backgroundImage: `linear-gradient(90deg, #0C1022 35%, rgba(12,16,34,0.35)), url(/flyers/photos/${form.photo}.jpg)` } : undefined}>
            <p className={st.pLabel}>{form.label || 'Announcement'}</p>
            <p className={st.pTitle}>{form.title || 'Your headline'}<span>.</span></p>
            {form.text && <p className={st.pText}>{form.text}</p>}
            {form.ctaLabel && <span className={st.pBtn}>{form.ctaLabel}</span>}
          </div>

          <h2 className={st.h2} style={{ marginTop: 26 }}>Current announcements</h2>
          {loading ? <p className={st.empty}>Loading.</p> : items.length === 0 ? (
            <p className={st.empty}>None yet. Agents see the vision and values slides until you add one.</p>
          ) : (
            <ul className={st.list}>
              {items.map(a => (
                <li key={a.id}>
                  <div className={st.itemMain}><b>{a.title}</b><small>{a.label || 'Announcement'} · position {a.order}</small></div>
                  <span className={st.state} data-on={state(a) === 'Showing' || undefined}>{state(a)}</span>
                  {confirmId === a.id ? (
                    <span className={st.rowBtns}><button type="button" className={st.danger} onClick={() => remove(a.id)}>Delete it</button><button type="button" className={st.ghost} onClick={() => setConfirmId(null)}>Keep</button></span>
                  ) : (
                    <span className={st.rowBtns}><button type="button" className={st.ghost} onClick={() => { setForm({ ...BLANK, ...a }); setMsg(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button><button type="button" className={st.ghost} onClick={() => setConfirmId(a.id)}>Delete</button></span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
