export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'IDENTITY_REQUIRED'
  | 'AGE_RESTRICTED'
  | 'COMPLIANCE_BLOCKED'
  | 'RED_FEATURE_FORBIDDEN'
  | 'INSUFFICIENT_FUNDS'
  | 'ON_HOLD'
  | 'LIMIT_EXCEEDED';

export const HTTP_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDENTITY_REQUIRED: 403,
  AGE_RESTRICTED: 403,
  COMPLIANCE_BLOCKED: 423,
  RED_FEATURE_FORBIDDEN: 422,
  INSUFFICIENT_FUNDS: 422,
  ON_HOLD: 423,
  LIMIT_EXCEEDED: 429,
};

export class DomainError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function assert(cond: unknown, code: ErrorCode, message: string): asserts cond {
  if (!cond) throw new DomainError(code, message);
}
