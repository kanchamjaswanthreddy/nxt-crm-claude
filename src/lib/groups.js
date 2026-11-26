/**
 * Code-defined groups and their policies.
 *
 * Groups cannot be created from the frontend — add new entries here.
 * Each group can define `menuLinks` that appear for members in the sidebar.
 */

export const GROUPS = [
  {
    id: 'nxt-medical-connect',
    name: 'NXT Medical Connect',
    description: 'Access to the ExamOne medical portal for ordering paramedical exams and managing medical requirements.',
    icon: 'medical',
    menuLinks: [
      {
        label: 'NXT Medical Connect',
        url: 'https://portal.examone.com/Dashboard',
        menu: 'business',       // which dropdown this appears in
        external: true,
      },
    ],
  },
  {
    id: 'billing-exempt',
    name: 'Billing Exempt',
    description: 'Members of this group are exempt from subscription billing. No monthly charge applies.',
    icon: 'billing-exempt',
    billingExempt: true,
  },
  {
    id: 'team-leaders',
    name: 'Team Leaders',
    description: 'Senior Financial Directors who act as sub-admins for their downline. Can approve agents, review documents, and manage their team.',
    icon: 'team-leader',
    teamLeader: true,
  },
  {
    id: 'help-desk',
    name: 'Help Desk',
    description: 'Members can manage and resolve NXT Help tickets raised by agents.',
    icon: 'help-desk',
    helpDesk: true,
  },
];

/** Look up a group definition by its ID */
export function getGroupById(groupId) {
  return GROUPS.find(g => g.id === groupId) || null;
}

/** Get all menu links a user should see based on their group memberships */
export function getMenuLinksForGroups(groupIds = []) {
  const links = [];
  for (const gid of groupIds) {
    const group = getGroupById(gid);
    if (group?.menuLinks) {
      links.push(...group.menuLinks);
    }
  }
  return links;
}
