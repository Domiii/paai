import fs from "fs";
import path from "path";
import NestedError from "./NestedError"; // Assuming NestedError is in the same directory

class ErrorMonitor {
  private contexts: any[] = [];

  addContext(context: any): void {
    this.contexts.push(context);
  }

  dumpToFile(filePath: string): void {
    const jsonl = this.contexts
      .map((context) => JSON.stringify(context))
      .join("\n");
    fs.writeFileSync(filePath, jsonl);
  }

  handleError(error: Error): void {
    const errorFilePath = getFilePathFromStackTrace(error);
    const errorDumpFilePath = path.join(
      errorFilePath ? path.dirname(errorFilePath) : process.cwd(),
      `error_dump_${Date.now()}.jsonl`
    );

    this.dumpToFile(errorDumpFilePath);
    throw new NestedError(
      `ErrorMonitor failure detected. Verbose dump at: ${errorDumpFilePath}`,
      error
    );
  }
}

function getFilePathFromStackTrace(error: Error): string | null {
  const stackLines = error.stack?.split("\n") || [];
  for (const line of stackLines) {
    const match = line.match(/\s+at\s+.+\s+\((.+):\d+:\d+\)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function ErrorMonitorDeco<T, K extends keyof T>(
  _Clazz?: new (...args: any[]) => T,
  monitorField?: K
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ): any {
    if (descriptor) {
      // This is a method decorator
      const originalMethod = descriptor.value;
      descriptor.value = wrapWithErrorMonitor(originalMethod);
      return descriptor;
    } else {
      // This is a function decorator
      return wrapWithErrorMonitor<T, K, typeof target>(target, monitorField);
    }
  };
}

function wrapWithErrorMonitor<T, K extends keyof T, F extends (...args: any[]) => any>(
  fn: F,
  monitorFieldRaw?: K
): (monitor: ErrorMonitor, ...args: any[]) => any {
  return function (...args: any[]) {
    // @ts-expect-error: TS2683
    const self = this;
    const monitorFieldName = (monitorFieldRaw || "monitor") as string;
    const monitor = self[monitorFieldName] as ErrorMonitor;
    try {
      if (!monitor) {
        throw new Error(
          `Field \`${monitorFieldName}\` (default="monitor", but can be overwritten as argument to ${ErrorMonitorDeco.name}) must be defined on classes of methods with @${ErrorMonitorDeco.name}`
        );
      }
      const result = fn.apply(self, args);

      if (result instanceof Promise) {
        // Handle async errors.
        return result.catch((error: Error) => {
          monitor.handleError(error);
          throw error; // Re-throw the error after handling
        });
      }

      return result;
    } catch (error: any) {
      // Handle sync errors.
      monitor.handleError(error as Error);
      throw error; // Re-throw the error after handling
    }
  } as F;
}

export { ErrorMonitor, ErrorMonitorDeco, getFilePathFromStackTrace };
