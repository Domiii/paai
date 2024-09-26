import fs from 'fs/promises';
import path from 'path';
import { FileBackedDictionary } from './FileBackedDictionary';

export class FileBackedDictionaryCollection<T> {
  private dictionaries: Map<string, FileBackedDictionary<T>>;
  public readonly path: string;

  constructor(folderPath: string) {
    this.path = folderPath;
    this.dictionaries = new Map<string, FileBackedDictionary<T>>();
  }

  async init(): Promise<void> {
    await this.loadDictionaries();
  }

  private async loadDictionaries(): Promise<void> {
    try {
      const files = await fs.readdir(this.path);
      for (const file of files) {
        if (path.extname(file) === '.jsonl') {
          const name = path.basename(file, '.jsonl');
          const dictionary = new FileBackedDictionary<T>(this.path, name);
          await dictionary.init();
          this.dictionaries.set(name, dictionary);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // Folder doesn't exist, start with an empty set of dictionaries
      await fs.mkdir(this.path, { recursive: true });
    }
  }

  async createDictionary(name: string): Promise<FileBackedDictionary<T>> {
    if (this.dictionaries.has(name)) {
      throw new Error(`Dictionary '${name}' already exists`);
    }
    const dictionary = new FileBackedDictionary<T>(this.path, name);
    await dictionary.init();
    this.dictionaries.set(name, dictionary);
    return dictionary;
  }

  getDictionary(name: string): FileBackedDictionary<T> | undefined {
    return this.dictionaries.get(name);
  }

  async deleteDictionary(name: string): Promise<boolean> {
    const dictionary = this.dictionaries.get(name);
    if (!dictionary) {
      return false;
    }
    await fs.unlink(dictionary.path);
    return this.dictionaries.delete(name);
  }

  async getAllDictionaries(): Promise<Map<string, FileBackedDictionary<T>>> {
    return new Map(this.dictionaries);
  }
}