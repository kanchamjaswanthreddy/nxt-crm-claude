'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser, requireAdmin } from '@/lib/serverAuth';

const PHOTOS = ['', 'our-vision', 'our-mission', 'partnership', 'responsibility', 'ownership', 'transparency', 'education', 'commitment', 'trust'];
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const link = (v) => { const s = str(v, 300); return s.startsWith('/') || s.startsWith('https://') ? s : ''; };
const shape = (id, d) => ({
  id, label: d.label || '', title: d.title || '', text: d.text || '', ctaLabel: d.ctaLabel || '', ctaHref: d.ctaHref || '',
  photo: d.photo || '', active: d.active !== false, order: Number(d.order) || 0, startsOn: d.startsOn || '', endsOn: d.endsOn || '',
});

/** Slides for the dashboard slideshow. Agents get the ones that are on and in date; admins can ask for all. */
export async function fetchAnnouncements(includeAll = false) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  const privileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
  try {
    const snap = await getAdminApp().firestore().collection('announcements').where('agencyId', '==', caller.agencyId).get();
    const today = new Date().toISOString().split('T')[0];
    let items = snap.docs.map(d => shape(d.id, d.data()));
    if (!(includeAll && privileged)) items = items.filter(a => a.active && (!a.startsOn || a.startsOn <= today) && (!a.endsOn || a.endsOn >= today));
    items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    return { success: true, announcements: items };
  } catch (error) { return { success: false, error: error.message }; }
}

export async function saveAnnouncement(data) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Only owners and admins can change announcements.' }; }
  const admin = getAdminApp(); const db = admin.firestore();
  const doc = {
    agencyId: caller.agencyId,
    label: str(data.label, 40), title: str(data.title, 110), text: str(data.text, 260),
    ctaLabel: str(data.ctaLabel, 30), ctaHref: link(data.ctaHref),
    photo: PHOTOS.includes(data.photo) ? data.photo : '',
    active: data.active !== false, order: Math.max(0, Math.min(999, Math.round(Number(data.order) || 0))),
    startsOn: day(data.startsOn), endsOn: day(data.endsOn),
    updatedBy: caller.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!doc.title) return { success: false, error: 'Add a headline.' };
  if (data.ctaHref && !doc.ctaHref) return { success: false, error: 'The button link must start with / (a CRM screen) or https://' };
  if (doc.ctaLabel && !doc.ctaHref) return { success: false, error: 'Add a link for the button, or clear the button text.' };
  if (doc.startsOn && doc.endsOn && doc.endsOn < doc.startsOn) return { success: false, error: 'The end date is before the start date.' };
  try {
    if (data.id) {
      const ref = db.collection('announcements').doc(String(data.id)); const cur = await ref.get();
      if (!cur.exists || cur.data().agencyId !== caller.agencyId) return { success: false, error: 'Announcement not found.' };
      await ref.update(doc);
      return { success: true, id: ref.id };
    }
    const count = await db.collection('announcements').where('agencyId', '==', caller.agencyId).get();
    if (count.size >= 20) return { success: false, error: 'There are already 20 announcements. Delete one first.' };
    const ref = await db.collection('announcements').add({ ...doc, createdBy: caller.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { success: true, id: ref.id };
  } catch (error) { return { success: false, error: error.message }; }
}

export async function deleteAnnouncement(id) {
  let caller;
  try { caller = await requireAdmin(); } catch { return { success: false, error: 'Only owners and admins can change announcements.' }; }
  try {
    const ref = getAdminApp().firestore().collection('announcements').doc(String(id)); const cur = await ref.get();
    if (!cur.exists || cur.data().agencyId !== caller.agencyId) return { success: false, error: 'Announcement not found.' };
    await ref.delete();
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}
