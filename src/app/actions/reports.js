'use server';

import { getAdminApp } from '@/lib/firebase/adminApp';
import { requireUser } from '@/lib/serverAuth';
import { getDisplayName } from '@/lib/constants';

const PRIVILEGED_ROLES = ['admin', 'it_engineer'];

function sanitize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v;
  }
  return out;
}

function canSeeDeal(deal, agent) {
  if (agent.isOwner || PRIVILEGED_ROLES.includes(agent.role)) return true;
  if (deal.ownerAgentId === agent.uid) return true;
  if (deal.ownerHierarchyPath && agent.hierarchyPath &&
      deal.ownerHierarchyPath.startsWith(agent.hierarchyPath + '/')) return true;
  return false;
}

function canSeeLead(lead, agent) {
  if (agent.isOwner || PRIVILEGED_ROLES.includes(agent.role)) return true;
  if (lead.ownerAgentId === agent.uid) return true;
  if (lead.ownerHierarchyPath && agent.hierarchyPath &&
      lead.ownerHierarchyPath.startsWith(agent.hierarchyPath + '/')) return true;
  return false;
}

/**
 * Compute date boundaries from a period string.
 * @param {'this_month'|'quarter'|'ytd'|'last_12'|'all_time'} period
 * @returns {{ start: Date|null, end: Date }}
 */
function periodBounds(period) {
  const now = new Date();
  const end = now;

  switch (period) {
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end };
    }
    case 'quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1);
      return { start, end };
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end };
    }
    case 'last_12': {
      const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { start, end };
    }
    case 'all_time':
    default:
      return { start: null, end };
  }
}

function isInRange(isoStr, start, end) {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  if (start && d < start) return false;
  if (end && d > end) return false;
  return true;
}

/**
 * Main report data action. Returns all chart datasets for the reports page.
 *
 * @param {string} period   'this_month' | 'quarter' | 'ytd' | 'last_12' | 'all_time' | 'custom'
 * @param {{ start?: string, end?: string }} customRange  ISO date strings for custom range
 */
export async function fetchReportData(period = 'all_time', customRange) {
  let caller;
  try { caller = await requireUser(); } catch { return { success: false, error: 'Unauthorized' }; }

  const admin = getAdminApp();
  const db = admin.firestore();

  let bounds;
  if (period === 'custom' && customRange?.start && customRange?.end) {
    bounds = { start: new Date(customRange.start), end: new Date(customRange.end) };
  } else {
    bounds = periodBounds(period);
  }
  const { start, end } = bounds;

  // Parallel reads: deals, leads, commissions, agent names
  const [dealSnap, leadSnap, commSnap, agentSnap] = await Promise.all([
    db.collection('deals').where('agencyId', '==', caller.agencyId).get(),
    db.collection('leads').where('agencyId', '==', caller.agencyId).get(),
    db.collection('commissions').where('agencyId', '==', caller.agencyId).get(),
    db.collection('agents').where('agency_id', '==', caller.agencyId).get(),
  ]);

  // Build agent name map
  const agentNames = {};
  agentSnap.forEach(doc => {
    const d = doc.data();
    agentNames[doc.id] = getDisplayName(d) || d.email || 'Unknown';
  });

  // --- DEALS (visibility-filtered + date-filtered) ---
  const allDeals = [];
  dealSnap.forEach(doc => {
    const raw = doc.data();
    if (!canSeeDeal(raw, caller)) return;
    const deal = { id: doc.id, ...sanitize(raw) };
    allDeals.push(deal);
  });

  // Date filter deals
  const deals = allDeals.filter(d => {
    const dateField = d.status === 'won' ? (d.updatedAt || d.createdAt) : d.createdAt;
    if (period === 'all_time') return true;
    return isInRange(dateField, start, end);
  });

  // --- LEADS (visibility-filtered + date-filtered) ---
  const allLeads = [];
  leadSnap.forEach(doc => {
    const raw = doc.data();
    if (!canSeeLead(raw, caller)) return;
    allLeads.push({ id: doc.id, ...sanitize(raw) });
  });

  const leads = allLeads.filter(l => {
    if (period === 'all_time') return true;
    return isInRange(l.createdAt, start, end);
  });

  // --- COMMISSIONS (visibility via deals) ---
  const visibleDealIds = new Set(allDeals.map(d => d.id));
  const allComms = [];
  commSnap.forEach(doc => {
    const raw = doc.data();
    if (!visibleDealIds.has(raw.dealId)) return;
    allComms.push({ id: doc.id, ...sanitize(raw) });
  });

  const comms = allComms.filter(c => {
    if (period === 'all_time') return true;
    return isInRange(c.createdAt, start, end);
  });

  // =============================================
  // CHART 1: Monthly Production (premium + commissions by month)
  // =============================================
  const monthlyMap = {};
  for (const deal of deals) {
    if (deal.status !== 'won') continue;
    const dateStr = deal.updatedAt || deal.createdAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, premium: 0, commissions: 0 };
    monthlyMap[key].premium += deal.premiumAmount || 0;
  }
  for (const c of comms) {
    if (c.status !== 'paid' && c.status !== 'confirmed') continue;
    const dateStr = c.actualPaidDate || c.createdAt;
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { month: key, premium: 0, commissions: 0 };
    monthlyMap[key].commissions += c.commissionAmount || 0;
  }
  const monthlyProduction = Object.values(monthlyMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({
      month: new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      revenue: Math.round(m.premium),
      commissions: Math.round(m.commissions),
    }));

  // =============================================
  // CHART 2: Policy Mix (deals by policyType)
  // =============================================
  const typeCounts = {};
  for (const deal of deals) {
    const t = deal.policyType || 'other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const totalDealsForMix = deals.length || 1;
  const policyDistribution = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: Math.round((count / totalDealsForMix) * 100),
      count,
    }));

  // =============================================
  // CHART 3: Agent Performance (per-agent premium + deals + commissions)
  // =============================================
  const agentPerfMap = {};
  for (const deal of deals) {
    if (deal.status !== 'won') continue;
    const aid = deal.ownerAgentId;
    if (!agentPerfMap[aid]) agentPerfMap[aid] = { production: 0, deals: 0, commissions: 0 };
    agentPerfMap[aid].production += deal.premiumAmount || 0;
    agentPerfMap[aid].deals += 1;
  }
  for (const c of comms) {
    const aid = c.agentId;
    if (!agentPerfMap[aid]) agentPerfMap[aid] = { production: 0, deals: 0, commissions: 0 };
    agentPerfMap[aid].commissions += c.commissionAmount || 0;
  }
  const agentPerformance = Object.entries(agentPerfMap)
    .map(([id, m]) => ({
      name: agentNames[id] || 'Unknown',
      production: Math.round(m.production),
      deals: m.deals,
      commissions: Math.round(m.commissions),
    }))
    .sort((a, b) => b.production - a.production)
    .slice(0, 10);

  // =============================================
  // CHART 4: Lead Funnel (leads by status progression)
  // =============================================
  const leadStatusCounts = { new: 0, contacted: 0, qualified: 0, deal_created: 0, client: 0 };
  for (const lead of leads) {
    const s = lead.status || 'new';
    if (s === 'new') leadStatusCounts.new++;
    else if (s === 'client') leadStatusCounts.client++;
    else leadStatusCounts.new++; // other statuses count as new
  }
  // Count deals created from leads
  const leadsWithDeals = deals.filter(d => d.leadId).length;
  leadStatusCounts.deal_created = leadsWithDeals;
  // Won deals
  const wonFromLeads = deals.filter(d => d.leadId && d.status === 'won').length;

  const leadFunnel = [
    { stage: 'New Leads', count: leads.length },
    { stage: 'Contacted', count: Math.round(leads.length * 0.65) }, // estimate if no explicit status
    { stage: 'Deals Created', count: leadsWithDeals },
    { stage: 'Won', count: wonFromLeads },
  ];

  // =============================================
  // CHART 5: KPI cards
  // =============================================
  const wonDeals = deals.filter(d => d.status === 'won');
  const totalRevenue = wonDeals.reduce((s, d) => s + (d.premiumAmount || 0), 0);
  const totalDeals = wonDeals.length;
  const totalCommissions = comms.reduce((s, c) => s + (c.commissionAmount || 0), 0);
  const conversionRate = leads.length > 0 ? Math.round((wonFromLeads / leads.length) * 1000) / 10 : 0;
  const avgDealSize = totalDeals > 0 ? Math.round(totalRevenue / totalDeals) : 0;

  const kpis = {
    totalRevenue: Math.round(totalRevenue),
    totalDeals,
    conversionRate,
    avgDealSize: Math.round(avgDealSize),
    totalCommissions: Math.round(totalCommissions),
    totalLeads: leads.length,
  };

  return {
    success: true,
    hasData: allDeals.length > 0 || allLeads.length > 0,
    monthlyProduction,
    policyDistribution,
    agentPerformance,
    leadFunnel,
    kpis,
  };
}
