/**
 * Custom error classes for ActivityPub federation
 * Replaces @sveltejs/kit error() with standalone error types
 */

/**
 * Base federation error
 */
export class FederationError extends Error {
  public readonly code: number;
  public readonly details?: unknown;

  constructor(message: string, code = 500, details?: unknown) {
    super(message);
    this.name = 'FederationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Error for when a resource is not found
 */
export class NotFoundError extends FederationError {
  constructor(message: string, details?: unknown) {
    super(message, 404, details);
    this.name = 'NotFoundError';
  }
}

/**
 * Error for unauthorized access
 */
export class UnauthorizedError extends FederationError {
  constructor(message: string, details?: unknown) {
    super(message, 401, details);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Error for bad requests
 */
export class BadRequestError extends FederationError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
    this.name = 'BadRequestError';
  }
}

/**
 * Error for delivery failures
 */
export class DeliveryError extends FederationError {
  public readonly recipientUri?: string;

  constructor(message: string, recipientUri?: string, details?: unknown) {
    super(message, 502, details);
    this.name = 'DeliveryError';
    this.recipientUri = recipientUri;
  }
}

/**
 * Error for signature verification failures
 */
export class SignatureVerificationError extends FederationError {
  constructor(message: string, details?: unknown) {
    super(message, 403, details);
    this.name = 'SignatureVerificationError';
  }
}
