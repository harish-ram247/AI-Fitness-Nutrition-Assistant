/**
 * Strongly typed error representation for API failures.
 * Preserves backend error codes and Pydantic validation details.
 */

export interface BackendValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface BackendErrorBody {
  detail?: string | BackendValidationErrorItem[];
  error?: {
    code?: string;
    message?: string;
  };
}

export type ApiErrorKind =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'BAD_REQUEST'           // 400
  | 'UNAUTHORIZED'          // 401
  | 'FORBIDDEN'             // 403
  | 'NOT_FOUND'             // 404
  | 'CONFLICT'              // 409
  | 'VALIDATION_ERROR'      // 422
  | 'RATE_LIMITED'          // 429
  | 'SERVER_ERROR'          // 5xx
  | 'UNKNOWN_ERROR';

export class ApiError extends Error {
  public readonly status: number;
  public readonly kind: ApiErrorKind;
  public readonly code: string | null;
  public readonly validationErrors: BackendValidationErrorItem[];
  public readonly rawBody: unknown;

  constructor(status: number, body?: unknown, messageOverride?: string) {
    const parsed = ApiError.parseBody(body);
    const kind = ApiError.statusToKind(status);
    const message = messageOverride || parsed.message || ApiError.defaultMessageForStatus(status);

    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
    this.code = parsed.code;
    this.validationErrors = parsed.validationErrors;
    this.rawBody = body;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  public static network(originalError?: Error): ApiError {
    const error = new ApiError(0, null, 'Network connection failed. Please check your internet connection.');
    (error as unknown as { kind: ApiErrorKind }).kind = 'NETWORK_ERROR';
    if (originalError) {
      error.cause = originalError;
    }
    return error;
  }

  public static timeout(): ApiError {
    const error = new ApiError(408, null, 'Request timed out. Please try again.');
    (error as unknown as { kind: ApiErrorKind }).kind = 'TIMEOUT_ERROR';
    return error;
  }

  private static statusToKind(status: number): ApiErrorKind {
    switch (status) {
      case 0:
        return 'NETWORK_ERROR';
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMITED';
      case 408:
        return 'TIMEOUT_ERROR';
      default:
        if (status >= 500 && status < 600) {
          return 'SERVER_ERROR';
        }
        return 'UNKNOWN_ERROR';
    }
  }

  private static defaultMessageForStatus(status: number): string {
    switch (status) {
      case 400:
        return 'Bad request. Please verify your input.';
      case 401:
        return 'Authentication required or session expired.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'Requested resource was not found.';
      case 409:
        return 'A conflict occurred with an existing resource.';
      case 422:
        return 'Validation error. Please verify the provided data.';
      case 429:
        return 'Too many requests. Please slow down and try again later.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Server error. Please try again later.';
      default:
        return `Unexpected error occurred (status ${status}).`;
    }
  }

  private static parseBody(body: unknown): {
    message: string | null;
    code: string | null;
    validationErrors: BackendValidationErrorItem[];
  } {
    let message: string | null = null;
    let code: string | null = null;
    let validationErrors: BackendValidationErrorItem[] = [];

    if (body && typeof body === 'object') {
      const b = body as BackendErrorBody;

      // Check for structured error field: { error: { code, message } }
      if (b.error && typeof b.error === 'object') {
        if (typeof b.error.message === 'string') {
          message = b.error.message;
        }
        if (typeof b.error.code === 'string') {
          code = b.error.code;
        }
      }

      // Check detail
      if (typeof b.detail === 'string') {
        if (!message) {
          message = b.detail;
        }
      } else if (Array.isArray(b.detail)) {
        // FastAPI 422 validation array
        validationErrors = b.detail;
        if (!message && validationErrors.length > 0) {
          const first = validationErrors[0];
          const field = first.loc.slice(1).join('.');
          message = field ? `${field}: ${first.msg}` : first.msg;
        }
      }
    }

    return { message, code, validationErrors };
  }
}
