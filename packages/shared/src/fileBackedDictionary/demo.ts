import { FileBackedDictionaryCollection } from "./FileBackedDictionaryCollection";
import { FileBackedDictionaryCLI } from "./FileBackedDictionaryCLI";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { inspect } from "util";

type DemoUser = {
  name: string;
  age: number;
};

(async function main() {
  // Demo the CLI
  let tempDir = path.join(os.tmpdir(), `test-${uuidv4()}`);
  await fs.mkdir(tempDir, { recursive: true });
  let collection = new FileBackedDictionaryCollection<DemoUser>(tempDir);
  await collection.init();

  // add 2 demo dictionaries
  (await collection.addDictionary("dict1")).add("alice", {
    name: "Alice",
    age: 30,
  });
  (await collection.addDictionary("dict2")).add("jon", {
    name: "Jon",
    age: 25,
  });

  let cli = new FileBackedDictionaryCLI(collection);
  const res = await cli.userPick();
  console.log(inspect(res));
})();
