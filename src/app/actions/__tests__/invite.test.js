import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getAdminApp — returns a fake Firestore
const mockGet = vi.fn();
const mockWhere = vi.fn(() => ({ where: mockWhere, limit: mockLimit, get: mockGet }));
const mockLimit = vi.fn(() => ({ get: mockGet }));
const mockCollection = vi.fn(() => ({ where: mockWhere }));
const mockDb = { collection: mockCollection, batch: vi.fn() };

vi.mock('@/lib/firebase/adminApp', () => ({
  getAdminApp: () => ({ firestore: () => mockDb }),
}));

vi.mock('@/lib/email/resend', () => ({
  sendInviteEmail: vi.fn(),
}));

// Disable 'use server' directive so we can import directly
vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://crm.nxtfinancialgroup.com');

const { createInvite } = await import('../invite.js');

const VALID_DATA = {
  email: 'new@example.com',
  role: 'agent',
  agency_id: 'agency-1',
};

describe('createInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: queries return empty (no duplicates)
    mockGet.mockResolvedValue({ empty: true, docs: [] });
  });

  it('aborts with friendly error when agency-email check throws', async () => {
    // First call (agency-scoped duplicate check) throws
    mockGet.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const result = await createInvite(VALID_DATA);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Could not verify email, please try again.');
  });

  it('aborts with friendly error when global email check throws', async () => {
    // First call succeeds (no agency duplicate)
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Second call (global duplicate check) throws
    mockGet.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const result = await createInvite(VALID_DATA);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Could not verify email, please try again.');
  });

  it('does not write to Firestore when email check fails', async () => {
    const mockAdd = vi.fn();
    mockCollection.mockImplementation((name) => {
      if (name === 'invites') return { where: mockWhere, add: mockAdd };
      return { where: mockWhere };
    });
    mockGet.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await createInvite(VALID_DATA);

    expect(mockAdd).not.toHaveBeenCalled();
  });
});
