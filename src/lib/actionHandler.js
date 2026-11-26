/**
 * Wraps a server action call to handle session expiry.
 * If the action returns { success: false, error: 'Unauthorized' },
 * redirects to login with an expired flag.
 */
export async function callAction(actionFn, ...args) {
  const result = await actionFn(...args);
  if (result && result.success === false && result.error === 'Unauthorized') {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?expired=1';
    }
    return result;
  }
  return result;
}
