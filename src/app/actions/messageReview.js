'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

// Compliance review of messages.
//
// Who: the agency owner, plus at most ONE more person the owner names. Admins and team heads have no access.
// How: read-only. A reviewer must type a reason before a conversation opens, and that access (who, which
//      conversation, when, why) is written to chatReviewLog. Nothing in this file edits or deletes a log
//      entry, and nothing here sends, edits, deletes or marks messages as read.
// What: the live messages plus the archive of deleted and edited originals, kept for the retention period.

const DEFAULT_YEARS = 7; const OPEN_WINDOW = 60 * 60 * 1000;
const text = (v, max) => String(v || '').trim().slice(0, max);
const nameOf = (a) => [a.first_name, a.last_name].filter(Boolean).join(' ') || a.full_name || a.email || 'Team member';
const iso = (t) => t?.toDate?.()?.toISOString?.() || (typeof t === 'string' ? t : null);

async function reviewer() {
  const caller = await requireUser();
  const admin = getAdminApp(); const db = admin.firestore();
  const snap = await db.collection('chatCompliance').doc(caller.agencyId).get();
  const settings = { reviewerIds: [], retentionYears: DEFAULT_YEARS, ...(snap.exists ? snap.data() : {}) };
  const allowed = caller.isOwner || settings.reviewerIds.includes(caller.uid);
  return { caller, admin, db, settings, allowed };
}

async function agencyPeople(db, agencyId) {
  const snap = await db.collection('agents').where('agency_id', '==', agencyId).get();
  const map = {}; snap.forEach(d => { map[d.id] = { name: nameOf(d.data()), path: d.data().hierarchyPath || '' }; });
  return map;
}
function titleFor(conv, people) {
  if (conv.type === 'direct') return (conv.memberIds || []).map(id => people[id]?.name || 'Former member').join(' and ');
  return conv.name || 'Group';
}

/** Whether the caller may review, plus the settings (only the owner can change them). */
export async function reviewAccess() {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.allowed) return { success: true, allowed: false };
  const people = await agencyPeople(r.db, r.caller.agencyId);
  return {
    success: true, allowed: true, isOwner: r.caller.isOwner, retentionYears: r.settings.retentionYears,
    reviewer: r.settings.reviewerIds[0] ? { id: r.settings.reviewerIds[0], name: people[r.settings.reviewerIds[0]]?.name || 'Team member' } : null,
    people: r.caller.isOwner ? Object.entries(people).filter(([id]) => id !== r.caller.uid).map(([id, p]) => ({ id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)) : [],
  };
}

/** Owner only: name (or remove) the one extra reviewer, and set how long deleted and edited originals are kept. */
export async function saveReviewSettings(input) {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.caller.isOwner) return { success: false, error: 'Only the owner can change these settings.' };
  try {
    const update = {};
    if (input?.retentionYears !== undefined) {
      const y = Number(input.retentionYears);
      if (!Number.isInteger(y) || y < 1 || y > 10) return { success: false, error: 'Choose between 1 and 10 years.' };
      update.retentionYears = y;
    }
    if (input?.reviewerId !== undefined) {
      const id = String(input.reviewerId || '');
      if (id) {
        const a = await r.db.collection('agents').doc(id).get();
        if (!a.exists || a.data().agency_id !== r.caller.agencyId || id === r.caller.uid) return { success: false, error: 'Person not found.' };
      }
      update.reviewerIds = id ? [id] : [];
    }
    await r.db.collection('chatCompliance').doc(r.caller.agencyId).set({ ...update, updatedAt: new Date().toISOString(), updatedBy: r.caller.uid }, { merge: true });
    // A change to who can review is itself recorded.
    if (update.reviewerIds) await r.db.collection('chatReviewLog').add({ agencyId: r.caller.agencyId, kind: 'settings', reviewerId: r.caller.uid, reviewerName: r.caller.fullName || r.caller.email, conversationId: '', conversationTitle: '', reason: update.reviewerIds[0] ? `Gave review access to ${(await r.db.collection('agents').doc(update.reviewerIds[0]).get().then(d => nameOf(d.data())))}` : 'Removed the second reviewer', at: new Date().toISOString() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** The list of conversations in the agency: who is in each and when it was last used. No message text. */
export async function reviewConversations() {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.allowed) return { success: false, error: 'You do not have access to message review.' };
  try {
    const [snap, people] = await Promise.all([r.db.collection('conversations').where('agencyId', '==', r.caller.agencyId).get(), agencyPeople(r.db, r.caller.agencyId)]);
    const list = snap.docs.map(d => { const v = d.data(); return { id: d.id, type: v.type, title: titleFor(v, people), members: v.type === 'direct' || v.type === 'group' ? (v.memberIds || []).map(id => people[id]?.name || 'Former member') : [], lastAt: v.lastAt || null }; })
      .filter(c => c.lastAt).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return { success: true, conversations: list };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Open one conversation for review. A reason is required and the access is logged before anything is returned. */
export async function reviewOpen(conversationId, reason) {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.allowed) return { success: false, error: 'You do not have access to message review.' };
  const why = text(reason, 300);
  if (why.length < 10) return { success: false, error: 'Give a reason of at least 10 characters.' };
  try {
    const ref = r.db.collection('conversations').doc(String(conversationId || '')); const cs = await ref.get();
    if (!cs.exists || cs.data().agencyId !== r.caller.agencyId) return { success: false, error: 'Conversation not found.' };
    const conv = cs.data(); const people = await agencyPeople(r.db, r.caller.agencyId); const title = titleFor(conv, people);
    await r.db.collection('chatReviewLog').add({ agencyId: r.caller.agencyId, kind: 'open', reviewerId: r.caller.uid, reviewerName: r.caller.fullName || r.caller.email, conversationId: ref.id, conversationTitle: title, reason: why, at: new Date().toISOString() });

    const [live, arch] = await Promise.all([ref.collection('messages').orderBy('createdAt', 'desc').limit(1000).get(), ref.collection('archive').get()]);
    const edits = {}; const rows = [];
    arch.forEach(d => { const a = d.data(); if (a.kind === 'edited') (edits[a.messageId] = edits[a.messageId] || []).push({ text: a.text, at: a.at }); });
    const shape = (id, m, extra) => ({ id, authorName: m.authorName || '', text: m.text || '', at: iso(m.createdAt), file: m.file ? { name: m.file.name, size: m.file.size } : null, card: m.card ? { type: m.card.type, name: m.card.name } : null, replyTo: m.replyTo ? { authorName: m.replyTo.authorName, text: m.replyTo.text } : null, earlier: (edits[extra.messageId || id] || []).sort((a, b) => a.at.localeCompare(b.at)), ...extra });
    live.forEach(d => rows.push(shape(d.id, d.data(), { deletedAt: null, archiveId: null })));
    arch.forEach(d => { const a = d.data(); if (a.kind === 'deleted') rows.push(shape(a.messageId, a, { deletedAt: a.at, archiveId: d.id, messageId: a.messageId })); });
    rows.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
    return { success: true, title, type: conv.type, members: conv.type === 'direct' || conv.type === 'group' ? (conv.memberIds || []).map(id => people[id]?.name || 'Former member') : [], messages: rows, reason: why, openedAt: new Date().toISOString(), reviewerName: r.caller.fullName || r.caller.email };
  } catch (error) { return { success: false, error: error.message }; }
}

/** A short-lived link to a file in a conversation the reviewer has opened (with a logged reason) in the last hour. */
export async function reviewFileUrl(conversationId, messageId, archiveId) {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.allowed) return { success: false, error: 'You do not have access to message review.' };
  try {
    const ref = r.db.collection('conversations').doc(String(conversationId || ''));
    const logs = await r.db.collection('chatReviewLog').where('reviewerId', '==', r.caller.uid).where('conversationId', '==', ref.id).get();
    const recent = logs.docs.some(d => d.data().kind === 'open' && Date.now() - new Date(d.data().at).getTime() < OPEN_WINDOW);
    if (!recent) return { success: false, error: 'Open the conversation again and give a reason first.' };
    const ds = archiveId ? await ref.collection('archive').doc(String(archiveId)).get() : await ref.collection('messages').doc(String(messageId)).get();
    const f = ds.exists ? ds.data().file : null;
    if (!f?.path || !f.path.startsWith(`chat/${r.caller.agencyId}/${ref.id}/`)) return { success: false, error: 'File not found.' };
    const [url] = await r.admin.storage().file(f.path).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 15 * 60 * 1000 });
    return { success: true, url };
  } catch { return { success: false, error: 'Could not open the file.' }; }
}

/** The access log. Reviewers can read it; nobody can change it. */
export async function reviewLog() {
  let r;
  try { r = await reviewer(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!r.allowed) return { success: false, error: 'You do not have access to message review.' };
  try {
    const snap = await r.db.collection('chatReviewLog').where('agencyId', '==', r.caller.agencyId).get();
    const entries = snap.docs.map(d => { const v = d.data(); return { id: d.id, kind: v.kind, reviewerName: v.reviewerName, conversationTitle: v.conversationTitle, reason: v.reason, at: v.at }; }).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 500);
    return { success: true, entries };
  } catch (error) { return { success: false, error: error.message }; }
}
