'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';

/**
 * Global search across leads, clients, deals, and tasks.
 * Returns up to 5 results per category, matched client-side from pre-fetched data.
 */
export async function globalSearch(query) {
  const caller = await requireUser();
  if (!query || query.trim().length < 2) return { success: true, results: [] };

  const q = query.trim().toLowerCase();
  const MAX_PER_CATEGORY = 5;

  const results = [];

  try {
    const admin = getAdminApp();
    const db = admin.firestore();

    // Fetch all in parallel — top-level collections filtered by agencyId
    const [leadsSnap, clientsSnap, dealsSnap, tasksSnap] = await Promise.all([
      db.collection('leads')
        .where('agencyId', '==', caller.agencyId)
        .where('ownerAgentId', '==', caller.uid)
        .limit(500)
        .get(),
      db.collection('clients')
        .where('agencyId', '==', caller.agencyId)
        .where('ownerAgentId', '==', caller.uid)
        .limit(500)
        .get(),
      db.collection('deals')
        .where('agencyId', '==', caller.agencyId)
        .where('agentId', '==', caller.uid)
        .limit(500)
        .get(),
      db.collection('tasks')
        .where('agencyId', '==', caller.agencyId)
        .where('ownerAgentId', '==', caller.uid)
        .limit(500)
        .get(),
    ]);

    // Search leads
    const leads = [];
    leadsSnap.forEach(doc => {
      const d = doc.data();
      const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
      const haystack = `${name} ${d.email || ''} ${d.phone || ''}`.toLowerCase();
      if (haystack.includes(q)) {
        leads.push({
          id: doc.id,
          type: 'lead',
          title: name || d.email || 'Unnamed Lead',
          meta: [d.status, d.email, d.phone].filter(Boolean).join(' \u00b7 '),
          href: `/dashboard/leads/${doc.id}`,
        });
      }
    });
    results.push(...leads.slice(0, MAX_PER_CATEGORY));

    // Search clients
    const clients = [];
    clientsSnap.forEach(doc => {
      const d = doc.data();
      const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
      const haystack = `${name} ${d.email || ''} ${d.phone || ''}`.toLowerCase();
      if (haystack.includes(q)) {
        clients.push({
          id: doc.id,
          type: 'client',
          title: name || d.email || 'Unnamed Client',
          meta: [d.email, d.phone].filter(Boolean).join(' \u00b7 '),
          href: `/dashboard/clients/${doc.id}`,
        });
      }
    });
    results.push(...clients.slice(0, MAX_PER_CATEGORY));

    // Search deals
    const deals = [];
    dealsSnap.forEach(doc => {
      const d = doc.data();
      const haystack = `${d.clientName || ''} ${d.policyType || ''} ${d.carrier || ''} ${d.id || ''}`.toLowerCase();
      if (haystack.includes(q)) {
        deals.push({
          id: doc.id,
          type: 'deal',
          title: d.clientName || `Deal #${doc.id.substring(0, 8)}`,
          meta: [d.policyType, d.carrier, d.status].filter(Boolean).join(' \u00b7 '),
          href: `/dashboard/deals/${doc.id}`,
        });
      }
    });
    results.push(...deals.slice(0, MAX_PER_CATEGORY));

    // Search tasks
    const tasks = [];
    tasksSnap.forEach(doc => {
      const d = doc.data();
      const haystack = `${d.title || ''} ${d.description || ''}`.toLowerCase();
      if (haystack.includes(q)) {
        tasks.push({
          id: doc.id,
          type: 'task',
          title: d.title || 'Untitled Task',
          meta: [d.status, d.priority, d.dueDate].filter(Boolean).join(' \u00b7 '),
          href: null,
        });
      }
    });
    results.push(...tasks.slice(0, MAX_PER_CATEGORY));

    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
