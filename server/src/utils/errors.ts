export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isAppError(error: unknown): error is AppError {
  return typeof error === "object" && error !== null && "statusCode" in error;
}

