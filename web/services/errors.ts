/**
 * Typed errors thrown by the service layer, mapped to HTTP status codes at
 * the API boundary (see lib/api/with-auth.ts). Throw a `ServiceError` with
 * one of these codes from a repository/service call and the route wrapper
 * turns it into the `{ error: { code, message } }` envelope with the right
 * status — no route handler needs its own try/catch translation logic.
 */

export type ServiceErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ServiceErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  /** HTTP status implied by `code` — looked up once, at construction time. */
  readonly status: number;

  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function isServiceError(err: unknown): err is ServiceError {
  return err instanceof ServiceError;
}
