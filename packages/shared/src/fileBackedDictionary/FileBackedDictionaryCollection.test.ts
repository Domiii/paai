import { FileBackedDictionaryCollection } from './FileBackedDictionaryCollection';
import { FileBackedDictionaryCLI } from './FileBackedDictionaryCLI';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { spawn } from 'child_process';

describe('FileBackedDictionaryCollection and CLI', () => {
  let tempDir: string;
  let collection: FileBackedDictionaryCollection<string>;
  let cli: FileBackedDictionaryCLI<string>;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `test-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });
    collection = new FileBackedDictionaryCollection<string>(tempDir);
    await collection.init();
    cli = new FileBackedDictionaryCLI<string>(collection);
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should create a new dictionary', async () => {
    const testInput = ['create', 'testDict', 'exit'];
    await runCliWithInput(cli, testInput);

    const dictionaries = await collection.getAllDictionaries();
    expect(dictionaries.has('testDict')).toBeTruthy();
  });

  it('should select an existing dictionary', async () => {
    const testInput = ['select', 'testDict', 'exit'];
    const output = await runCliWithInput(cli, testInput);

    expect(output).toContain('Selected dictionary: testDict');
  });

  it('should delete an existing dictionary', async () => {
    const testInput = ['delete', 'testDict', 'y', 'exit'];
    await runCliWithInput(cli, testInput);

    const dictionaries = await collection.getAllDictionaries();
    expect(dictionaries.has('testDict')).toBeFalsy();
  });

  it('should sort dictionaries by modification date', async () => {
    await collection.createDictionary('dict1');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await collection.createDictionary('dict2');

    const testInput = ['select', 'exit'];
    const output = await runCliWithInput(cli, testInput);

    const dict1Index = output.indexOf('dict1');
    const dict2Index = output.indexOf('dict2');
    expect(dict1Index).toBeLessThan(dict2Index);
  });
});

async function runCliWithInput(cli: FileBackedDictionaryCLI<string>, input: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['-e', `
      const cli = ${cli.constructor.name}.fromJSON(${JSON.stringify(cli)});
      cli.renderMenu().catch(console.error);
    `]);

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });

    let inputIndex = 0;
    const sendNextInput = () => {
      if (inputIndex < input.length) {
        child.stdin.write(input[inputIndex] + '\n');
        inputIndex++;
        setTimeout(sendNextInput, 500); // Wait for 500ms before sending the next input
      } else {
        child.stdin.end();
      }
    };

    sendNextInput();
  });
}
