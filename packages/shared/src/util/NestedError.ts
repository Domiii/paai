export default class NestedError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    this.updateMessageAndStack();
  }

  private updateMessageAndStack(): void {
    if (this.cause) {
      this.message = `${this.message}\n  [caused by] ${this.cause.message}`;
      this.stack = `${this.stack}\n  [caused by] ${this.cause.stack}`;
    }
  }

  toString(): string {
    return this.stack || this.message;
  }
}
