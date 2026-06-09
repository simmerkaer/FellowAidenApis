import type { ZodError } from 'zod';

/** Base class for all errors thrown by this library. */
export class FellowAidenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Authentication failed (bad credentials, or re-auth on a 401 did not recover). */
export class AuthError extends FellowAidenError {}

/** The API returned a non-2xx response. */
export class ApiError extends FellowAidenError {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `Fellow Aiden API responded with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** Input failed Zod validation before being sent to the API. */
export class ValidationError extends FellowAidenError {
  readonly issues: ZodError['issues'];

  constructor(error: ZodError, context?: string) {
    const prefix = context ? `${context}: ` : '';
    const detail = error.issues
      .map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`)
      .join('; ');
    super(`${prefix}${detail}`);
    this.issues = error.issues;
  }
}
