'use server';

import { randomUUID } from 'crypto';
import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { isRateLimited } from '@/lib/validation';

// Messaging between people in the agency. No calls, just messages and files.
//
// conversations/{id}            type: 'direct' | 'group' | 'agency' | 'team'
//   direct, group : memberIds lists who is in it
//   agency        : everyone in the agency ("Everyone")
//   team          : a team head and everyone under them
// conversations/{id}/messages/{id}
//
// Privacy: a person can only read a conversation they are a member of. There is NO admin or owner
// override anywhere in this file. The one exception is the compliance review in messageReview.js:
// the owner (and at most one person the owner names) can read a chat there, read-only, after giving a
// reason, and every such access is logged.
// Deleting or editing a message hides it from everyone in the chat straight away; the original is kept
// in conversations/{id}/archive for the retention period, where only the compliance review can see it.
// Everything is read and written here, on the server; the browser never touches these collections.

const MAX_TEXT = 4000; const MAX_FILE = 25 * 1024 * 1024; const PAGE = 60;
const FILE_TYPES = {
  'application/pdf': ['.pdf'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'], 'text/plain': ['.txt'], 'text/csv': ['.csv'],
  'application/msword': ['.doc'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'], 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};
const REACTIONS = ['👍', '❤️', '😂', '🎉', '✅', '🙏'];
const CARD_TYPES = { lead: 'leads', client: 'clients', deal: 'deals' };
const text = (v, max) => String(v || '').trim().slice(0, max);
const nameOf = (a) => [a.first_name, a.last_name].filter(Boolean).join(' ') || a.full_name || a.email || 'Team member';
const iso = (t) => t?.toDate?.()?.toISOString?.() || (typeof t === 'string' ? t : null);

async function ctx() {
  const caller = await requireUser();
  const admin = getAdminApp(); const db = admin.firestore();
  const snap = await db.collection('agents').doc(caller.uid).get();
  const path = (snap.exists && snap.data().hierarchyPath) || `/${caller.uid}`;
  return { caller, admin, db, path };
}

/** The one membership rule. No role bypass. */
function isMember(conv, caller, path) {
  if (!conv || conv.agencyId !== caller.agencyId) return false;
  if (conv.type === 'agency') return true;
  if (conv.type === 'team') return conv.leaderId === caller.uid || path.includes(`/${conv.leaderId}/`);
  return (conv.memberIds || []).includes(caller.uid);
}

async function loadConv(c, id) {
  const ref = c.db.collection('conversations').doc(String(id || ''));
  const snap = await ref.get();
  if (!snap.exists || !isMember(snap.data(), c.caller, c.path)) return { ref, conv: null };
  return { ref, conv: snap.data() };
}

const shapeMsg = (id, m, uid) => ({
  id, authorId: m.authorId, authorName: m.authorName || '', text: m.text || '', at: iso(m.createdAt), editedAt: m.editedAt || null,
  replyTo: m.replyTo || null, file: m.file ? { name: m.file.name, size: m.file.size, type: m.file.type } : null, card: m.card || null,
  reactions: Object.entries(m.reactions || {}).map(([emoji, ids]) => ({ emoji, count: ids.length, mine: ids.includes(uid) })).filter(r => r.count > 0),
  mine: m.authorId === uid,
});

/** Every conversation the caller belongs to, newest first, with unread counts. Also makes sure the standing channels exist. */
export async function listConversations() {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db, path } = c;
  try {
    // Standing channels: "Everyone", and one per team head above the caller (or the caller, if they head a team).
    const leaderSnap = await db.collection('group_members').where('groupId', '==', 'team-leaders').get();
    const leaderIds = leaderSnap.docs.map(d => d.data().agentId);
    const myLeaders = leaderIds.filter(id => id === caller.uid || path.includes(`/${id}/`));
    const standing = [{ id: `everyone_${caller.agencyId}`, data: { type: 'agency', name: 'Everyone' } }];
    if (myLeaders.length) {
      const docs = await db.getAll(...myLeaders.map(id => db.collection('agents').doc(id)));
      docs.forEach(d => { if (d.exists && d.data().agency_id === caller.agencyId) standing.push({ id: `team_${d.id}`, data: { type: 'team', leaderId: d.id, name: `${nameOf(d.data())}'s Team` } }); });
    }
    const standingSnaps = await db.getAll(...standing.map(x => db.collection('conversations').doc(x.id)));
    await Promise.all(standingSnaps.map((snap, i) => snap.exists ? null : snap.ref.set({ ...standing[i].data, agencyId: caller.agencyId, memberIds: [], lastAt: null, lastText: '', lastRead: {}, createdAt: new Date().toISOString() })));

    const [mineSnap, ...chanSnaps] = await Promise.all([
      db.collection('conversations').where('memberIds', 'array-contains', caller.uid).get(),
      ...standing.map(x => db.collection('conversations').doc(x.id).get()),
    ]);
    const all = [...mineSnap.docs, ...chanSnaps.filter(s => s.exists)];
    const seen = new Set(); const list = [];
    all.forEach(d => {
      const v = d.data(); if (seen.has(d.id) || !isMember(v, caller, path)) return; seen.add(d.id);
      const lastRead = (v.lastRead || {})[caller.uid] || '';
      list.push({
        id: d.id, type: v.type, name: v.name || '', memberIds: v.memberIds || [], leaderId: v.leaderId || null,
        lastAt: v.lastAt || null, lastText: v.lastText || '', lastBy: v.lastBy || '',
        unread: !!v.lastAt && v.lastAt > lastRead && v.lastById !== caller.uid, lastReadAt: lastRead,
      });
    });
    list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '') || a.name.localeCompare(b.name));
    const cs = await db.collection('chatCompliance').doc(caller.agencyId).get(); const comp = cs.exists ? cs.data() : {};
    return { success: true, me: caller.uid, conversations: list, unread: list.filter(x => x.unread).length, retentionYears: comp.retentionYears || 7, canReview: caller.isOwner || (comp.reviewerIds || []).includes(caller.uid) };
  } catch (error) { return { success: false, error: error.message }; }
}

/** The number for the menu badge and the newest unread chat (for the alert). A light check: it reads only the
 *  caller's own chats and channels and changes nothing. */
export async function unreadMessageCount() {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db, path } = c;
  try {
    const above = path.split('/').filter(Boolean);
    const [mine, ...chans] = await Promise.all([
      db.collection('conversations').where('memberIds', 'array-contains', caller.uid).get(),
      db.collection('conversations').doc(`everyone_${caller.agencyId}`).get(),
      ...above.map(id => db.collection('conversations').doc(`team_${id}`).get()),
    ]);
    const seen = new Set(); let unread = 0; let latest = null;
    [...mine.docs, ...chans.filter(d => d.exists)].forEach(d => {
      const v = d.data(); if (seen.has(d.id) || !isMember(v, caller, path)) return; seen.add(d.id);
      if (!v.lastAt || v.lastById === caller.uid || v.lastAt <= ((v.lastRead || {})[caller.uid] || '')) return;
      unread += 1;
      if (!latest || v.lastAt > latest.at) latest = { id: d.id, at: v.lastAt, by: v.lastBy || 'Someone', in: v.type === 'direct' ? '' : (v.name || '') };
    });
    return { success: true, unread, latest };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Open (or start) a one-to-one chat. */
export async function startDirect(otherId) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db } = c; const other = String(otherId || '');
  if (!other || other === caller.uid) return { success: false, error: 'Choose someone else to message.' };
  try {
    const o = await db.collection('agents').doc(other).get();
    if (!o.exists || o.data().agency_id !== caller.agencyId) return { success: false, error: 'Person not found.' };
    const id = `dm_${[caller.uid, other].sort().join('_')}`;
    const ref = db.collection('conversations').doc(id);
    if (!(await ref.get()).exists) await ref.set({ type: 'direct', agencyId: caller.agencyId, memberIds: [caller.uid, other].sort(), name: '', lastAt: null, lastText: '', lastRead: {}, createdAt: new Date().toISOString(), createdBy: caller.uid });
    return { success: true, id };
  } catch (error) { return { success: false, error: error.message }; }
}

async function realMembers(db, caller, ids) {
  const list = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter(x => x && x !== caller.uid).slice(0, 200);
  if (!list.length) return [];
  const docs = await db.getAll(...list.map(id => db.collection('agents').doc(id)));
  return docs.filter(d => d.exists && d.data().agency_id === caller.agencyId).map(d => d.id);
}

/** Anyone can start a group chat. */
export async function createGroup(name, memberIds) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, db } = c; const title = text(name, 60);
  if (!title) return { success: false, error: 'Give the group a name.' };
  if (isRateLimited(`group-create:${caller.uid}`, 20, 3600000)) return { success: false, error: 'Too many groups created. Please try again later.' };
  try {
    const members = await realMembers(db, caller, memberIds);
    if (!members.length) return { success: false, error: 'Add at least one other person.' };
    const ref = await db.collection('conversations').add({ type: 'group', agencyId: caller.agencyId, name: title, memberIds: [caller.uid, ...members], lastAt: new Date().toISOString(), lastText: `${caller.fullName || 'Someone'} started the group`, lastBy: '', lastById: caller.uid, lastRead: {}, createdAt: new Date().toISOString(), createdBy: caller.uid });
    return { success: true, id: ref.id };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Group members can rename the group, add people, or leave. */
export async function updateGroup(id, change) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv || conv.type !== 'group') return { success: false, error: 'Group not found.' };
    const FieldValue = c.admin.firestore.FieldValue;
    if (change?.leave) { await ref.update({ memberIds: FieldValue.arrayRemove(c.caller.uid) }); return { success: true, left: true }; }
    const update = {};
    if (change?.name !== undefined) { const title = text(change.name, 60); if (!title) return { success: false, error: 'Give the group a name.' }; update.name = title; }
    if (change?.add) { const add = await realMembers(c.db, c.caller, change.add); if (add.length) update.memberIds = FieldValue.arrayUnion(...add); }
    if (Object.keys(update).length) await ref.update(update);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Messages in one conversation. With `after`, only newer ones (used to refresh an open chat). Marks it read. */
export async function fetchMessages(id, after) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    let q = ref.collection('messages').orderBy('createdAt', 'desc');
    const since = after ? new Date(after) : null;
    if (since && !Number.isNaN(since.getTime())) q = q.where('createdAt', '>', since);
    const snap = await q.limit(since ? 200 : PAGE).get();
    const messages = snap.docs.map(d => shapeMsg(d.id, d.data(), c.caller.uid)).reverse();
    if (conv.lastAt && ((conv.lastRead || {})[c.caller.uid] || '') < conv.lastAt) await ref.update({ [`lastRead.${c.caller.uid}`]: new Date().toISOString() });
    // "Seen" for one-to-one chats: when the other person last opened it.
    const otherId = conv.type === 'direct' ? (conv.memberIds || []).find(x => x !== c.caller.uid) : null;
    return { success: true, messages, seenAt: otherId ? ((conv.lastRead || {})[otherId] || null) : null, changedAt: conv.changedAt || null };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Send a message: text, and optionally a reply reference, an uploaded file, or a record card. */
export async function sendMessage(id, input) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const { caller, admin, db } = c;
  if (isRateLimited(`msg:${caller.uid}`, 120, 60000)) return { success: false, error: 'You are sending messages too quickly. Wait a moment.' };
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const body = text(input?.text, MAX_TEXT);

    let file = null;
    if (input?.file?.path) {
      // The file must be one this person just uploaded into this conversation.
      const prefix = `chat/${caller.agencyId}/${ref.id}/${caller.uid}/`;
      const path = String(input.file.path);
      if (!path.startsWith(prefix) || path.includes('..')) return { success: false, error: 'That file cannot be attached.' };
      const [meta] = await admin.storage().file(path).getMetadata().catch(() => [null]);
      if (!meta) return { success: false, error: 'The file did not finish uploading. Please try again.' };
      if (Number(meta.size) > MAX_FILE) { await admin.storage().file(path).delete().catch(() => {}); return { success: false, error: 'File too large. Maximum 25 MB.' }; }
      file = { path, name: text(input.file.name, 140) || 'file', size: Number(meta.size), type: meta.contentType || '' };
    }

    let card = null;
    if (input?.card && CARD_TYPES[input.card.type] && input.card.id) {
      const rs = await db.collection(CARD_TYPES[input.card.type]).doc(String(input.card.id)).get();
      // Only a record this person can already open themselves.
      const r0 = rs.exists ? rs.data() : null; const mineOrPrivileged = r0 && (caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer' || (input.card.type === 'client' ? r0.agentId : r0.ownerAgentId) === caller.uid);
      if (r0 && r0.agencyId === caller.agencyId && mineOrPrivileged) { const r = r0; card = { type: input.card.type, id: rs.id, name: text(r.clientName || r.leadName || [r.firstName, r.lastName].filter(Boolean).join(' '), 120) }; }
    }
    if (!body && !file && !card) return { success: false, error: 'Write a message first.' };

    let replyTo = null;
    if (input?.replyTo) {
      const rs = await ref.collection('messages').doc(String(input.replyTo)).get();
      if (rs.exists) replyTo = { id: rs.id, authorName: rs.data().authorName || '', text: (rs.data().text || (rs.data().file ? rs.data().file.name : '') || '').slice(0, 140) };
    }

    const now = new Date();
    const authorName = caller.fullName || caller.email;
    const msgRef = await ref.collection('messages').add({ authorId: caller.uid, authorName, text: body, file, card, replyTo, reactions: {}, createdAt: admin.firestore.Timestamp.fromDate(now) });
    const preview = body || (file ? `Sent a file: ${file.name}` : `Shared a ${card.type}: ${card.name}`);
    await ref.update({ lastAt: now.toISOString(), lastText: preview.slice(0, 120), lastBy: authorName, lastById: caller.uid, [`lastRead.${caller.uid}`]: now.toISOString() });

    // @mentions put a notice on that person's bell. Only people who are in this conversation.
    if (body.includes('@')) {
      let candidates = conv.memberIds || [];
      if (conv.type !== 'direct' && conv.type !== 'group') candidates = (await db.collection('agents').where('agency_id', '==', caller.agencyId).get()).docs.filter(d => conv.type === 'agency' || d.id === conv.leaderId || (d.data().hierarchyPath || '').includes(`/${conv.leaderId}/`)).map(d => d.id);
      const docs = candidates.length ? await db.getAll(...candidates.filter(x => x !== caller.uid).slice(0, 300).map(x => db.collection('agents').doc(x))) : [];
      const lower = body.toLowerCase();
      await Promise.all(docs.filter(d => d.exists && lower.includes(`@${nameOf(d.data()).toLowerCase()}`)).map(d => db.collection('notifications').add({
        userId: d.id, agencyId: caller.agencyId, type: 'info', read: false, href: `/dashboard/messages?c=${ref.id}`,
        message: `${authorName} mentioned you in ${conv.type === 'direct' ? 'a message' : (conv.name || 'a chat')}`, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => null)));
    }
    return { success: true, message: shapeMsg(msgRef.id, { authorId: caller.uid, authorName, text: body, file, card, replyTo, reactions: {}, createdAt: now.toISOString() }, caller.uid) };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Edit your own message's text. */
export async function editMessage(id, messageId, body) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const mref = ref.collection('messages').doc(String(messageId)); const ms = await mref.get();
    if (!ms.exists || ms.data().authorId !== c.caller.uid) return { success: false, error: 'You can only edit your own messages.' };
    const next = text(body, MAX_TEXT);
    if (!next && !ms.data().file && !ms.data().card) return { success: false, error: 'A message cannot be empty.' };
    const now = new Date().toISOString();
    if (next !== (ms.data().text || '')) await ref.collection('archive').add({ kind: 'edited', messageId: mref.id, at: now, authorId: ms.data().authorId, authorName: ms.data().authorName || '', text: ms.data().text || '', createdAt: ms.data().createdAt });
    await mref.update({ text: next, editedAt: now }); await ref.update({ changedAt: now });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Delete your own message. It disappears for everyone in the chat; the original moves to the compliance archive. */
export async function deleteMessage(id, messageId) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const mref = ref.collection('messages').doc(String(messageId)); const ms = await mref.get();
    if (!ms.exists || ms.data().authorId !== c.caller.uid) return { success: false, error: 'You can only delete your own messages.' };
    const m = ms.data();
    await ref.collection('archive').add({ kind: 'deleted', messageId: mref.id, at: new Date().toISOString(), authorId: m.authorId, authorName: m.authorName || '', text: m.text || '', file: m.file || null, card: m.card || null, replyTo: m.replyTo || null, createdAt: m.createdAt });
    await mref.delete();
    // Keep the conversation list honest about what the latest message is.
    const last = await ref.collection('messages').orderBy('createdAt', 'desc').limit(1).get();
    const l = last.empty ? null : last.docs[0].data();
    await ref.update({ changedAt: new Date().toISOString(), lastText: l ? (l.text || (l.file ? `Sent a file: ${l.file.name}` : l.card ? `Shared a ${l.card.type}: ${l.card.name}` : '')).slice(0, 120) : '', lastBy: l ? l.authorName : '', lastById: l ? l.authorId : '' });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

export async function toggleReaction(id, messageId, emoji) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!REACTIONS.includes(emoji)) return { success: false, error: 'Unknown reaction.' };
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const mref = ref.collection('messages').doc(String(messageId)); const ms = await mref.get();
    if (!ms.exists) return { success: false, error: 'Message not found.' };
    const has = ((ms.data().reactions || {})[emoji] || []).includes(c.caller.uid); const FieldValue = c.admin.firestore.FieldValue;
    await mref.update({ [`reactions.${emoji}`]: has ? FieldValue.arrayRemove(c.caller.uid) : FieldValue.arrayUnion(c.caller.uid) });
    await ref.update({ changedAt: new Date().toISOString() });
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

/** Step 1 of attaching a file: a short-lived link the browser uploads the file to. */
export async function getChatUploadUrl(id, { fileName, contentType, size } = {}) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const exts = FILE_TYPES[contentType]; const ext = `.${String(fileName || '').split('.').pop().toLowerCase()}`;
    if (!exts || !exts.includes(ext)) return { success: false, error: 'That file type cannot be shared. Use PDF, images, Word, Excel, PowerPoint, CSV or text files.' };
    if (!size || size < 1) return { success: false, error: 'File is empty.' };
    if (size > MAX_FILE) return { success: false, error: 'File too large. Maximum 25 MB.' };
    if (isRateLimited(`chat-upload:${c.caller.uid}`, 40, 3600000)) return { success: false, error: 'Too many uploads. Please try again later.' };
    const safe = String(fileName).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    const path = `chat/${c.caller.agencyId}/${ref.id}/${c.caller.uid}/${randomUUID()}-${safe}`;
    const [uploadUrl] = await c.admin.storage().file(path).getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 10 * 60 * 1000, contentType });
    return { success: true, uploadUrl, path };
  } catch (error) { return { success: false, error: error.message }; }
}

/** A short-lived link to open a shared file. Only for members of that conversation. */
export async function getChatFileUrl(id, messageId) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  try {
    const { ref, conv } = await loadConv(c, id);
    if (!conv) return { success: false, error: 'Conversation not found.' };
    const ms = await ref.collection('messages').doc(String(messageId)).get();
    if (!ms.exists || !ms.data().file?.path) return { success: false, error: 'File not found.' };
    const f = ms.data().file;
    const [url] = await c.admin.storage().file(f.path).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 15 * 60 * 1000, responseDisposition: `attachment; filename="${f.name.replace(/[^A-Za-z0-9._ -]+/g, '_')}"` });
    return { success: true, url };
  } catch { return { success: false, error: 'Could not open the file.' }; }
}

/** Search the caller's own conversations (recent messages only). */
export async function searchMessages(query) {
  let c;
  try { c = await ctx(); } catch { return { success: false, error: 'Unauthorized' }; }
  const needle = text(query, 60).toLowerCase();
  if (needle.length < 2) return { success: true, results: [] };
  try {
    const list = await listConversations();
    if (!list.success) return list;
    const results = [];
    await Promise.all(list.conversations.slice(0, 40).map(async (conv) => {
      const snap = await c.db.collection('conversations').doc(conv.id).collection('messages').orderBy('createdAt', 'desc').limit(150).get();
      snap.forEach(d => { const m = d.data(); const hay = `${m.text || ''} ${m.file?.name || ''}`.toLowerCase(); if (hay.includes(needle)) results.push({ conversationId: conv.id, id: d.id, authorName: m.authorName || '', text: (m.text || m.file?.name || '').slice(0, 160), at: iso(m.createdAt) }); });
    }));
    results.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return { success: true, results: results.slice(0, 40) };
  } catch (error) { return { success: false, error: error.message }; }
}
