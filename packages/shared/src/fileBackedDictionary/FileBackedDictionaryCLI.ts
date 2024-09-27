import inquirer from 'inquirer';
import { FileBackedDictionaryCollection } from './FileBackedDictionaryCollection';
import fs from 'fs/promises';
import { Stats } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { FileBackedDictionary } from './FileBackedDictionary';

export class FileBackedDictionaryCLI<T> {
  private folder: FileBackedDictionaryCollection<T>;

  constructor(folder: FileBackedDictionaryCollection<T>) {
    this.folder = folder;
  }

  async renderMenu(): Promise<void> {
    const choices = [
      { name: 'Create new dictionary', value: 'create' },
      { name: 'Select dictionary', value: 'select' },
      { name: 'Delete dictionary', value: 'delete' },
      { name: 'Exit', value: 'exit' },
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices,
      },
    ]);

    switch (action) {
      case 'create':
        await this.createDictionary();
        break;
      case 'select':
        await this.selectDictionary();
        break;
      case 'delete':
        await this.deleteDictionary();
        break;
      case 'exit':
        console.log('Goodbye!');
        process.exit(0);
    }

    await this.renderMenu();
  }

  private async createDictionary(): Promise<void> {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter the name for the new dictionary:',
        validate: (input: string) => input.trim() !== '' || 'Name cannot be empty',
      },
    ]);

    try {
      await this.folder.createDictionary(name);
      console.log(chalk.green(`Dictionary '${name}' created successfully.`));
    } catch (err: any) {
      console.error(chalk.red(`Error creating dictionary: ${err.message}`));
    }
  }

  private async selectDictionary(): Promise<void> {
    const key = await this.userPickKey();
    if (key) {
      console.log(chalk.green(`Selected dictionary: ${key}`));
      // Here you can add more actions for the selected dictionary
    }
  }

  private async deleteDictionary(): Promise<void> {
    const key = await this.userPickKey();
    if (key) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete the dictionary '${key}'?`,
          default: false,
        },
      ]);

      if (confirm) {
        const success = await this.folder.deleteDictionary(key);
        if (success) {
          console.log(chalk.green(`Dictionary '${key}' deleted successfully.`));
        } else {
          console.log(chalk.red(`Failed to delete dictionary '${key}'.`));
        }
      }
    }
  }

  async userPickKey(): Promise<string | null> {
    const dictionaries = await this.folder.getAllDictionaries();
    const sortedEntries = await this.getSortedEntries(dictionaries);

    if (sortedEntries.length === 0) {
      console.log(chalk.yellow('No dictionaries available.'));
      return null;
    }

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select a dictionary:',
        choices: sortedEntries.map(([key, stats]) => ({
          name: `${key} (Last modified: ${stats.mtime.toLocaleString()})`,
          value: key,
        })),
      },
    ]);

    return selected;
  }

  async userPick(): Promise<FileBackedDictionary<T> | null> {
    const key = await this.userPickKey();
    if (key) {
      const dictionary = this.folder.getDictionary(key);
      return dictionary || null;
    }
    return null;
  }

  private async getSortedEntries(dictionaries: Map<string, any>): Promise<[string, Stats][]> {
    const entries: [string, Stats][] = await Promise.all(
      Array.from(dictionaries.keys()).map(async (key) => {
        const stats = await fs.stat(path.join(this.folder.path, `${key}.jsonl`));
        return [key, stats];
      })
    );

    return entries.sort((a, b) => a[1].mtime.getTime() - b[1].mtime.getTime());
  }
}
