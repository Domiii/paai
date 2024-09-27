import { FileBackedDictionaryCollection } from "./FileBackedDictionaryCollection";
import { FileBackedDictionaryCLI } from "./FileBackedDictionaryCLI";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { writeToStdin } from "../util/writeToStdin";

type DemoUser = {
  name: string;
  age: number;
};

describe("FileBackedDictionaryCLI", () => {
  let tempDir: string;
  let collection: FileBackedDictionaryCollection<DemoUser>;
  let cli: FileBackedDictionaryCLI<DemoUser>;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `test-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });
    collection = new FileBackedDictionaryCollection<DemoUser>(tempDir);
    await collection.init();
    cli = new FileBackedDictionaryCLI<DemoUser>(collection);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("should create and retrieve dictionaries", async () => {
    await collection.addDictionary("dict1");
    const dict1 = collection.getDictionary("dict1");
    if (!dict1) throw new Error("dict1 not created");

    await dict1.add("alice", { name: "Alice", age: 30 });

    writeToStdin("dict1\n");
    const selectedDict = await cli.userPick();

    expect(selectedDict).not.toBeNull();
    if (selectedDict) {
      const alice = await selectedDict.get("alice");
      expect(alice).toEqual({ name: "Alice", age: 30 });
    }

    const allDicts = await collection.getAllDictionaries();
    expect(allDicts.size).toBe(1);
    expect(allDicts.has("dict1")).toBe(true);
  });

  test("should delete a dictionary", async () => {
    await collection.addDictionary("dict-to-delete");

    writeToStdin("dict-to-delete\ny\n");
    await cli.deleteDictionary();

    const allDicts = await collection.getAllDictionaries();
    expect(allDicts.size).toBe(0);
    expect(allDicts.has("dict-to-delete")).toBe(false);
  });

  test("should handle empty dictionary collection", async () => {
    writeToStdin("\n");
    const result = await cli.userPickKey();
    expect(result).toBeNull();
  });

  test("should create a new dictionary", async () => {
    writeToStdin("new-dict\n");
    await cli.addDictionary();

    const allDicts = await collection.getAllDictionaries();
    expect(allDicts.size).toBe(1);
    expect(allDicts.has("new-dict")).toBe(true);
  });

  test("should select a dictionary", async () => {
    await collection.addDictionary("test-dict");
    writeToStdin("test-dict\n");

    const selectedDict = await cli.userPick();
    expect(selectedDict).not.toBeNull();
    if (selectedDict) {
      expect(selectedDict.path).toContain("test-dict");
    }
  });
});
