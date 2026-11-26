export const AGENT_LEVELS = [
  { level: 1, title: 'Unlicensed Associate', price: 10 },
  { level: 2, title: 'Financial Associate', price: 20 },
  { level: 3, title: 'Senior Financial Associate', price: 25 },
  { level: 4, title: 'Financial Director', price: 30 },
  { level: 5, title: 'Senior Financial Director', price: 40 },
];

// Roles exempt from subscription fees
export const SUBSCRIPTION_EXEMPT_ROLES = ['it_engineer'];

export function isSubscriptionExempt(agent) {
  if (!agent) return false;
  if (agent.is_owner) return true;
  if (agent.billingExempt) return true;
  if (SUBSCRIPTION_EXEMPT_ROLES.includes(agent.role)) return true;
  return false;
}

// Permission helpers — IT Engineer has same privileges as owner
export function hasAdminAccess(agent) {
  if (!agent) return false;
  const role = agent.role || agent;
  return ['admin', 'it_engineer'].includes(role) || agent.is_owner;
}

export function hasManagerAccess(agent) {
  if (!agent) return false;
  const role = agent.role || agent;
  return ['admin', 'it_engineer'].includes(role) || agent.is_owner;
}

/**
 * Returns display name from first_name + middle_name + last_name, with fallback to full_name for legacy records.
 */
export function getDisplayName(agent) {
  if (!agent) return '';
  if (agent.first_name || agent.last_name) {
    return [agent.first_name, agent.middle_name, agent.last_name].filter(Boolean).join(' ');
  }
  return agent.full_name || agent.name || agent.email || '';
}

export function getRoleLabel(agent) {
  if (!agent) return '';
  if (agent.is_owner) return 'Admin';
  if (agent.role === 'it_engineer') return 'Admin';
  if (agent.role === 'admin') return 'Admin';
  return agent.role;
}
