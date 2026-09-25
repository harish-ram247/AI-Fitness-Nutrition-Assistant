/**
 * Frontend security utilities for input validation and safe URL navigation.
 */

/**
 * Validates password strength matching backend constraints in backend/app/schemas/user.py:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character from [!@#$%^&*(),.?":{}|<>]
 *
 * Returns error string if invalid, or null if valid.
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain an uppercase letter';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain a digit';
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return 'Password must contain a special character (!@#$%^&*(),.?":{}|<>)';
  }
  return null;
}

/**
 * Validates an intended redirect URL to prevent Open Redirect attacks.
 *
 * A valid relative path must:
 * 1. Start with a single slash '/'
 * 2. Not start with '//' (protocol-relative URL)
 * 3. Not start with '/\' (Windows path tricks)
 * 4. Not contain a colon ':' before a slash or query (preventing javascript:, https:, etc.)
 *
 * Falls back to defaultPath (default: '/dashboard') if validation fails.
 */
export function getSafeReturnTo(rawReturnTo: string | null | undefined, defaultPath = '/dashboard'): string {
  if (!rawReturnTo || typeof rawReturnTo !== 'string') {
    return defaultPath;
  }

  const trimmed = rawReturnTo.trim();

  // Must begin with '/' and not '//' or '/\'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultPath;
  }

  // Prevent protocol injection e.g. /login?returnTo=javascript:... or https:...
  // Extract path portion before query or hash
  const pathPart = trimmed.split('?')[0].split('#')[0];
  if (pathPart.includes(':')) {
    return defaultPath;
  }

  return trimmed;
}
