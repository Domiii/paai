import fs from 'fs';
import path from 'path';
import NestedError from './NestedError'; // Assuming NestedError is in the same directory

class ErrorMonitor {
  private contexts: any[] = [];

  addContext(context: any): void {
    this.contexts.push(context);
  }

  dumpToFile(filePath: string): void {
    const jsonl = this.contexts.map(context => JSON.stringify(context)).join('\n');
    fs.writeFileSync(filePath, jsonl);
  }
}

function getFilePathFromStackTrace(error: Error): string | null {
  const stackLines = error.stack?.split('\n') || [];
  for (const line of stackLines) {
    const match = line.match(/\s+at\s+.+\s+\((.+):\d+:\d+\)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

function ErrorMonitorDeco() {
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
      return wrapWithErrorMonitor(target);
    }
  };
}

function wrapWithErrorMonitor<T extends (...args: any[]) => any>(fn: T): T {
  return function(this: any, ...args: any[]) {
    const monitor = new ErrorMonitor();

    try {
      const result = fn.apply(this, args);

      // If the result is a promise, we need to handle async errors
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          handleError(error, monitor);
          throw error; // Re-throw the error after handling
        });
      }

      return result;
    } catch (error: any) {
      handleError(error as Error, monitor);
      throw error; // Re-throw the error after handling
    }
  } as T;
}

function handleError(error: Error, monitor: ErrorMonitor): void {
  const errorFilePath = getFilePathFromStackTrace(error);
  const errorDumpFilePath = path.join(
    errorFilePath ? path.dirname(errorFilePath) : process.cwd(),
    `error_dump_${Date.now()}.jsonl`
  );

  monitor.dumpToFile(errorDumpFilePath);
  throw new NestedError(`Error monitor failure detected. Verbose dump at: ${errorDumpFilePath}`, error);
}

export { ErrorMonitor, ErrorMonitorDeco, getFilePathFromStackTrace };
