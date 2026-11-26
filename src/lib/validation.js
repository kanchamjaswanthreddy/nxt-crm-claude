/**
 * Shared server-side validation helpers.
 * Used by all server actions to enforce data integrity.
 */

// ─── Field length limits ───────────────────────────────────────────────────
const FIELD_LIMITS = {
  name: 100,         // first name, last name, display names
  email: 254,        // RFC 5321
  phone: 20,         // international format with spaces/dashes
  subject: 200,      // ticket subjects, task titles
  description: 5000, // long-form text
  note: 5000,        // notes, comments
  address: 200,      // address line, city
  state: 2,          // US state code
  zip: 10,           // ZIP+4
  general: 500,      // catch-all for misc fields
  policyNumber: 50,
  ssn4: 4,
  nxtId: 20,
  url: 2000,
};

/**
 * Validate that a string does not exceed the given length limit.
 * Returns null if valid, or an error message if too long.
 * @param {string} value
 * @param {string} fieldName - human-readable field name for error messages
 * @param {number} maxLen
 * @returns {string|null}
 */
export function validateLength(value, fieldName, maxLen) {
  if (typeof value !== 'string') return null;
  if (value.length > maxLen) {
    return `${fieldName} must be ${maxLen} characters or fewer.`;
  }
  return null;
}

/**
 * Validate multiple fields against their limits.
 * @param {Array<[string, string, number]>} fields - [value, fieldName, maxLen]
 * @returns {string|null} first error or null
 */
export function validateLengths(fields) {
  for (const [value, fieldName, maxLen] of fields) {
    const err = validateLength(value, fieldName, maxLen);
    if (err) return err;
  }
  return null;
}

// ─── Email validation ──────────────────────────────────────────────────────
// Stricter than the old /^\S+@\S+\.\S+$/ — catches most invalid formats
// while staying practical (not trying to match the full RFC 5322 spec).
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Returns null if valid or missing, error string if present but invalid.
 */
export function validateEmail(email) {
  if (!email) return null;
  if (typeof email !== 'string') return 'Email must be a string.';
  if (email.length > FIELD_LIMITS.email) return `Email must be ${FIELD_LIMITS.email} characters or fewer.`;
  if (!EMAIL_RE.test(email)) return 'Please enter a valid email address.';
  return null;
}

// ─── Phone validation ──────────────────────────────────────────────────────
// Accepts 7-15 digits (ITU-T E.164 range), optionally with spaces, dashes,
// parens, dots, or a leading +.
const PHONE_DIGITS_RE = /^\+?[\d\s\-().]{7,20}$/;

/**
 * Returns null if valid or missing, error string if present but invalid.
 */
export function validatePhone(phone) {
  if (!phone) return null;
  if (typeof phone !== 'string') return 'Phone must be a string.';
  if (phone.length > FIELD_LIMITS.phone) return `Phone must be ${FIELD_LIMITS.phone} characters or fewer.`;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 'Phone number must have between 7 and 15 digits.';
  if (!PHONE_DIGITS_RE.test(phone)) return 'Please enter a valid phone number.';
  return null;
}

// ─── Rate limiting (in-memory, per-process) ────────────────────────────────
// For serverless: each cold start resets the map, so this is best-effort.
// For persistent servers it works well. The embed form also has a Firestore
// fallback for cross-instance enforcement.
const rateLimitMap = new Map();

/**
 * Check whether a key (e.g. userId or IP) has exceeded the allowed number
 * of actions within the given window.
 * @param {string} key - unique identifier (uid, IP, etc.)
 * @param {number} maxActions - max allowed actions in the window
 * @param {number} windowMs - window duration in milliseconds
 * @returns {boolean} true if rate limited (should block)
 */
export function isRateLimited(key, maxActions, windowMs) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 1 };
    rateLimitMap.set(key, entry);
    return false;
  }

  entry.count += 1;
  if (entry.count > maxActions) return true;
  return false;
}

// ─── SSN4 validation ───────────────────────────────────────────────────────
export function validateSSN4(ssn4) {
  if (!ssn4) return null;
  if (!/^\d{4}$/.test(ssn4)) return 'SSN last 4 must be exactly 4 digits.';
  return null;
}

export { FIELD_LIMITS };
