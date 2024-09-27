import fs from "fs/promises";
import path from "path";
import { readFileOrNull } from "../util/fsUtil";

export class FileBackedDictionary<T> {
  private data: Map<string, T>;
  public readonly path: string;

  constructor(parentPath: string, name: string) {
    this.path = path.join(parentPath, `${name}.jsonl`);
    this.data = new Map<string, T>();
  }

  async init(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    const content = await readFileOrNull(this.path);
    if (!content) {
      // File doesn't exist: start with an empty dictionary.
      return;
    }
    const lines = content.split("\n").filter((line) => line.trim() !== "");
    for (const line of lines) {
      const [key, value] = JSON.parse(line);
      this.data.set(key, value);
    }
  }

  private async save(): Promise<void> {
    const content = Array.from(this.data.entries())
      .map((entry) => JSON.stringify(entry))
      .join("\n");
    await fs.writeFile(this.path, content, "utf-8");
  }

  async add(key: string, value: T): Promise<void> {
    if (this.data.has(key)) {
      throw new Error(`Key '${key}' already exists`);
    }
    this.data.set(key, value);
    await this.save();
  }

  async get(key: string): Promise<T | undefined> {
    return this.data.get(key);
  }

  async update(key: string, value: T): Promise<void> {
    if (!this.data.has(key)) {
      throw new Error(`Key '${key}' does not exist`);
    }
    this.data.set(key, value);
    await this.save();
  }

  async delete(key: string): Promise<boolean> {
    const result = this.data.delete(key);
    if (result) {
      await this.save();
    }
    return result;
  }

  async getAll(): Promise<Map<string, T>> {
    return new Map(this.data);
  }
}
