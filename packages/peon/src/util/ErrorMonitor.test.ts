import fs from "fs";
import path from "path";
import {
  ErrorMonitor,
  ErrorMonitorDeco,
  getFilePathFromStackTrace,
} from "./ErrorMonitor";

const DumpDir = __dirname;

describe("ErrorMonitor", () => {
  let testDir: string;

  beforeAll(() => {
    testDir = path.join(DumpDir, "test_output");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
    
    // Clean up any error dump files
    const files = fs.readdirSync(DumpDir);
    files
      .filter(
        (file) => file.startsWith("error_dump_") && file.endsWith(".jsonl")
      )
      // TODO: This does not work.
      .forEach((file) => fs.unlinkSync(path.join(DumpDir, file)));
  });

  test("ErrorMonitor addContext and dumpToFile work correctly", () => {
    const monitor = new ErrorMonitor();
    monitor.addContext({ key: "value" });
    monitor.addContext({ another: "context" });

    const filePath = path.join(testDir, "test_dump.jsonl");
    monitor.dumpToFile(filePath);

    const fileContent = fs.readFileSync(filePath, "utf-8");
    expect(fileContent).toBe('{"key":"value"}\n{"another":"context"}');

    // Clean up the test file
    fs.unlinkSync(filePath);
  });
});

describe("ErrorMonitorDeco", () => {
  afterEach(() => {
    // Clean up any error dump files
    const files = fs.readdirSync(process.cwd());
    files
      .filter(
        (file) => file.startsWith("error_dump_") && file.endsWith(".jsonl")
      )
      .forEach((file) => fs.unlinkSync(path.join(process.cwd(), file)));
  });

  test("ErrorMonitorDeco handles synchronous errors", () => {
    class TestClass {
      @ErrorMonitorDeco()
      throwError() {
        throw new Error("Test error");
      }
    }

    const testInstance = new TestClass();
    expect(() => testInstance.throwError()).toThrow("Error dump:");

    // Check if an error dump file was created
    const files = fs.readdirSync(DumpDir);
    const errorDumpFile = files.find(
      (file) => file.startsWith("error_dump_") && file.endsWith(".jsonl")
    )!;
    expect(errorDumpFile).toBeTruthy();

    const fileContent = fs.readFileSync(
      path.join(DumpDir, errorDumpFile),
      "utf-8"
    );
    expect(fileContent).toBe(""); // No context was added in this test
  });

  test("ErrorMonitorDeco handles asynchronous errors", async () => {
    class TestClass {
      @ErrorMonitorDeco()
      async throwAsyncError() {
        throw new Error("Async test error");
      }
    }

    const testInstance = new TestClass();
    await expect(testInstance.throwAsyncError()).rejects.toThrow("Error dump:");

    // Check if an error dump file was created
    const files = fs.readdirSync(DumpDir);
    const errorDumpFile = files.find(
      (file) => file.startsWith("error_dump_") && file.endsWith(".jsonl")
    );
    expect(errorDumpFile).toBeTruthy();

    if (errorDumpFile) {
      const fileContent = fs.readFileSync(
        path.join(DumpDir, errorDumpFile),
        "utf-8"
      );
      expect(fileContent).toBe(""); // No context was added in this test
    }
  });

  test("ErrorMonitorDeco preserves function return value", () => {
    class TestClass {
      @ErrorMonitorDeco()
      returnValue() {
        return 42;
      }
    }

    const testInstance = new TestClass();
    expect(testInstance.returnValue()).toBe(42);
  });

  test("ErrorMonitorDeco preserves async function return value", async () => {
    class TestClass {
      @ErrorMonitorDeco()
      async returnAsyncValue() {
        return 42;
      }
    }

    const testInstance = new TestClass();
    await expect(testInstance.returnAsyncValue()).resolves.toBe(42);
  });
});

describe("getFilePathFromStackTrace", () => {
  test("extracts file path from stack trace", () => {
    const error = new Error("Test error");
    const result = getFilePathFromStackTrace(error);
    expect(result).toBe(__filename);
  });

  test("returns null when file path cannot be extracted", () => {
    const error = new Error("Test error");
    error.stack = "Error: Test error\n    at Object.<anonymous>";

    const result = getFilePathFromStackTrace(error);
    expect(result).toBeNull();
  });
});
