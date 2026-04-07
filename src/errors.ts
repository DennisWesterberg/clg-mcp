// Copyright (c) 2026 Aistrateg Malmö AB. Licensed under BUSL-1.1.
export class CLGError extends Error {
  public override readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CLGError';
    this.cause = cause;
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      cause: this.cause instanceof Error ? this.cause.message : this.cause,
    };
  }
}

export class CLGDeniedError extends CLGError {
  public readonly receiptId: string | null;
  public readonly reason: string | null;

  public constructor(message: string, receiptId: string | null, reason: string | null) {
    super(message);
    this.name = 'CLGDeniedError';
    this.receiptId = receiptId;
    this.reason = reason;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      receiptId: this.receiptId,
      reason: this.reason,
    };
  }
}

export class CLGUnreachableError extends CLGError {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CLGUnreachableError';
  }
}

export class CLGToolExecutionError extends CLGError {
  public readonly toolName: string;

  public constructor(message: string, toolName: string, cause: unknown) {
    super(message, cause);
    this.name = 'CLGToolExecutionError';
    this.toolName = toolName;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      toolName: this.toolName,
    };
  }
}

export class CLGConfigError extends CLGError {
  public readonly issues: string[];

  public constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'CLGConfigError';
    this.issues = issues;
  }

  public override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      issues: this.issues,
    };
  }
}
