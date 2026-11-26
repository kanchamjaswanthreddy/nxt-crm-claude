/**
 * Consolidated document type definitions used across onboarding,
 * Documents Manager, and admin review pages.
 */

/** All known document types with labels and metadata */
export const DOCUMENT_TYPES = {
  // ── Onboarding (required) ──
  government_id: {
    label: 'Government-Issued Photo ID',
    description: "Driver's license, passport, or state ID (front & back)",
    category: 'onboarding',
    required: true,
    accept: 'image/*,.pdf',
  },
  w9: {
    label: 'W-9 Tax Form',
    description: 'Completed and signed IRS Form W-9 (Request for Taxpayer Identification Number)',
    category: 'tax',
    required: true,
    accept: '.pdf,image/*',
    templateUrl: '/documents/W9.pdf',
    helpText: 'Download the blank W-9 form, fill it out, sign it, then upload the completed copy.',
  },
  voided_check: {
    label: 'Voided Check or Direct Deposit Form',
    description: 'For commission payment setup',
    category: 'onboarding',
    required: true,
    accept: 'image/*,.pdf',
  },

  // ── Onboarding (optional) ──
  eo_certificate: {
    label: 'E&O Insurance Certificate',
    description: 'Current Errors & Omissions certificate (if available)',
    category: 'compliance',
    required: false,
    accept: 'image/*,.pdf',
  },
  state_license: {
    label: 'State Insurance License',
    description: 'Current state license document (if available)',
    category: 'compliance',
    required: false,
    accept: 'image/*,.pdf',
  },

  // ── Tax forms ──
  // w9 is above under onboarding-required since it's both

  driving_license_front: {
    label: 'Driving License (Front)',
    description: 'Front side of valid driving license',
    category: 'identification',
    required: false,
    accept: 'image/*,.pdf',
  },
  driving_license_back: {
    label: 'Driving License (Back)',
    description: 'Back side of valid driving license',
    category: 'identification',
    required: false,
    accept: 'image/*,.pdf',
  },

  // ── Compliance / Other ──
  anti_money_laundering: {
    label: 'Anti-Money Laundering Certificate',
    description: 'AML training certificate',
    category: 'compliance',
    required: false,
    accept: '.pdf,image/*',
  },
  background_check: {
    label: 'Background Check',
    description: 'Background check authorization or results',
    category: 'compliance',
    required: false,
    accept: '.pdf,image/*',
  },
  other: {
    label: 'Other',
    description: 'Any other supporting document',
    category: 'other',
    required: false,
    accept: '.pdf,image/*',
  },
};

/** Legacy document types that should be hidden from filters (old data) */
export const HIDDEN_DOC_TYPES = ['direct_deposit', 'ssn_card', 'driving_license'];

/** Label overrides for legacy/unlisted docType keys */
const LEGACY_LABELS = {
  direct_deposit: 'Direct Deposit',
  ssn_card: 'SSN Card',
  driving_license: 'Driving License',
  eo_insurance: 'E&O Insurance',
};

/** Get a human-readable label for any docType key */
export function getDocTypeLabel(docType) {
  return DOCUMENT_TYPES[docType]?.label || LEGACY_LABELS[docType] || docType;
}

/** Documents shown in the onboarding upload step */
export const ONBOARDING_DOCUMENTS = [
  { key: 'government_id', ...DOCUMENT_TYPES.government_id, optional: true },
  { key: 'w9', ...DOCUMENT_TYPES.w9, optional: true },
  { key: 'voided_check', ...DOCUMENT_TYPES.voided_check, optional: true },
  { key: 'eo_certificate', ...DOCUMENT_TYPES.eo_certificate, optional: true },
  { key: 'state_license', ...DOCUMENT_TYPES.state_license, optional: true },
];

/** Document types available in the Documents Manager upload dropdown */
export const DOCUMENTS_MANAGER_TYPES = [
  { value: 'government_id', label: DOCUMENT_TYPES.government_id.label },
  { value: 'driving_license_front', label: DOCUMENT_TYPES.driving_license_front.label },
  { value: 'driving_license_back', label: DOCUMENT_TYPES.driving_license_back.label },
  { value: 'w9', label: DOCUMENT_TYPES.w9.label },
  { value: 'voided_check', label: DOCUMENT_TYPES.voided_check.label },
  { value: 'eo_insurance', label: 'E&O Insurance' },
  { value: 'state_license', label: DOCUMENT_TYPES.state_license.label },
  { value: 'anti_money_laundering', label: DOCUMENT_TYPES.anti_money_laundering.label },
  { value: 'background_check', label: DOCUMENT_TYPES.background_check.label },
  { value: 'other', label: DOCUMENT_TYPES.other.label },
];

/** Tax-related document types for the Tax Forms section */
export const TAX_FORM_TYPES = ['w9'];

/**
 * Returns true if the agent is required to submit a W-9.
 * Only plain agents (not owners, admins, or IT engineers) need one.
 * @param {{ role?: string, is_owner?: boolean }} agent
 */
export function requiresW9(agent) {
  if (!agent) return false;
  if (agent.is_owner) return false;
  if (['admin', 'it_engineer'].includes(agent.role)) return false;
  return agent.role === 'agent';
}

/**
 * Compute the W-9 status for an agent given their documents.
 * @param {{ role?: string, is_owner?: boolean }} agent
 * @param {Array<{ docType: string, status: string }>} docs - agentDocuments records
 * @returns {'not_required' | 'missing' | 'pending_review' | 'approved' | 'rejected'}
 */
export function getW9Status(agent, docs) {
  if (!requiresW9(agent)) return 'not_required';
  const w9Doc = (docs || []).find(d => d.docType === 'w9');
  if (!w9Doc) return 'missing';
  if (w9Doc.status === 'approved') return 'approved';
  if (w9Doc.status === 'rejected') return 'rejected';
  return 'pending_review';
}
