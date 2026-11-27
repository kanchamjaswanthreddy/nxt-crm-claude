import { isInSubtree } from '@/lib/serverAuth';

/**
 * Personal details on an agent's record that colleagues have no reason to receive:
 * identity numbers, date of birth, home address, the background questionnaire, employment history,
 * the signed agreement, and card / Stripe details.
 */
export const PRIVATE_AGENT_FIELDS = [
  'date_of_birth', 'ssn', 'ssn_last4', 'itin', 'itin_last4', 'address', 'suite', 'zip',
  'employment', 'employer', 'position', 'work_phone', 'start_date', 'end_date', 'current',
  'qualification', 'work_authorization', 'bankruptcy', 'life_licensed', 'maintained_license', 'license_suspended',
  'debt_to_imo', 'legal_action', 'agreement', 'documentSignatures', 'onboardingDraft',
  'payment', 'stripe_customer_id', 'stripe_subscription_id', 'nextChargeDate', 'trialStartDate', 'subscriptionStartDate',
];

export function stripPrivate(agent) {
  const out = { ...agent };
  PRIVATE_AGENT_FIELDS.forEach(k => { delete out[k]; });
  return out;
}

/**
 * What a caller may receive about each person in a team list:
 * - owners, admins and IT: everything;
 * - a team leader: everything for people in their own downline;
 * - anyone: everything about themselves;
 * - otherwise: the record without the private fields above.
 */
export function scopeAgentsForCaller(agents, caller, { isLeader = false } = {}) {
  const privileged = caller.isOwner || caller.role === 'admin' || caller.role === 'it_engineer';
  if (privileged) return agents;
  return agents.map(a => {
    const id = a.id || a.uid;
    if (id === caller.uid) return a;
    if (isLeader && isInSubtree(a.hierarchyPath, caller.uid)) return a;
    return stripPrivate(a);
  });
}
