export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} no encontrado: ${id}`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class InfrastructureError extends DomainError {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "InfrastructureError";
    if (cause) this.cause = cause;
  }
}