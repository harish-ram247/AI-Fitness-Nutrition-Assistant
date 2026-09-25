import { ApiError } from '../api/errors';

/**
 * Extracts a user-friendly error message from an unknown error (typically ApiError or Error).
 */
export function getErrorMessage(
  err: unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.',
): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallbackMessage;
}
