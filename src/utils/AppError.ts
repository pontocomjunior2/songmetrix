export class AppError extends Error {
  public readonly message: string;
  public readonly details?: string;

  constructor(message: string, details?: string) {
    super(message);
    this.message = message;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
} 