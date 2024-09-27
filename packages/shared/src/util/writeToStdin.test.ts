import { writeToStdin } from "./writeToStdin";

const TIMEOUT = 1000; // 1 second timeout

async function timeout(ms: number): Promise<never> {
  return await new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms));
}

function readFromStdin(): Promise<string> {
  return new Promise<string>((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk.toString();
    });
    process.stdin.on('end', () => {
      resolve(data);
    });
  });
}

async function writeAndRead(input: string): Promise<string> {
  const writePromise = writeToStdin(input + "\n");
  const readPromise = readFromStdin();
  
  return Promise.race([
    Promise.all([writePromise, readPromise]).then(([, data]) => data),
    timeout(TIMEOUT)
  ]);
}

describe('writeToStdin', () => {
  it('should write input to stdin and be readable from stdin', async () => {
    const input = 'Hello, world!';
    const output = await writeAndRead(input);
    expect(output).toBe(input);
  });

  it('should handle multi-line input correctly', async () => {
    const input = 'Line 1\nLine 2\nLine 3';
    const output = await writeAndRead(input);
    expect(output).toBe(input);
  });

  it('should handle empty input', async () => {
    const input = '';
    const output = await writeAndRead(input);
    expect(output).toBe(input);
  });
});
