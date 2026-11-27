'use server';

import { requireUser } from '@/lib/serverAuth';
import DIRECTORY from '@/data/carrierDirectory.json';
import TIMES from '@/data/carrierProcessingTimes.json';

// Carrier Resources: who to call at each carrier. The list lives in src/data/carrierDirectory.json
// and is only ever sent to signed-in users, one carrier department at a time.
const SECTION_ORDER = ['Sales Support', 'New Business & Underwriting', 'Licensing & Contracting', 'Commissions', 'Policyholder Services'];
const CATEGORY_ORDER = ['Life', 'Annuity', 'Disability', 'Asset-Based LTC'];
const byOrder = (order) => (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b);

/** The three pick-lists: categories, the carriers in each, and the departments each carrier has. */
export async function fetchCarrierOptions() {
  try { await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  const categories = [...new Set(DIRECTORY.map(p => p.category))].sort(byOrder(CATEGORY_ORDER)).map(category => ({
    name: category,
    carriers: DIRECTORY.filter(p => p.category === category)
      .map(p => ({ name: p.carrier, note: p.note || '', departments: Object.keys(p.sections).sort(byOrder(SECTION_ORDER)) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
  return { success: true, categories };
}

/** The contacts for one carrier department. All three choices are required. */
export async function fetchCarrierContacts(category, carrier, department) {
  try { await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (!category || !carrier || !department) return { success: false, error: 'Choose a category, a carrier and a department.' };
  const page = DIRECTORY.find(p => p.category === category && p.carrier === carrier);
  if (!page || !page.sections[department]) return { success: false, error: 'Nothing is listed for that choice.' };
  const entries = page.sections[department];
  return {
    success: true,
    carrier: { name: page.carrier, category: page.category, note: page.note, website: page.website, phone: page.phone, mail: page.mail, overnight: page.overnight },
    department,
    departments: entries.filter(e => e.type === 'Department'),
    contacts: entries.filter(e => e.type !== 'Department'),
  };
}

/** How long each carrier takes to review new business. kind = 'annuity' or 'life'. */
export async function fetchProcessingTimes(kind) {
  try { await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }
  if (kind !== 'annuity' && kind !== 'life') return { success: false, error: 'Unknown list.' };
  return { success: true, checked: TIMES.checked, rows: TIMES[kind] };
}
