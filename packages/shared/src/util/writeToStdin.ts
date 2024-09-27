import { spawn } from "child_process";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// TODO: This cannot work because we can never write to stdin.
export async function writeToStdin(input: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const child = spawn(
      "node",
      [
        "-e",
        `
     console.log("DDBG SPAWN A");
      process.stdin.on('data', (data) => {
        console.log("DDBG SPAWN C: " + data);
        try {
          process.stdout.write(data);
        } catch (error) {
          if (error.code !== 'EPIPE') {
            console.error("Error writing to stdout:", error);
          }
        }
      });
      process.stdin.on('end', (res) => {
        console.log("DDBG SPAWN D: " + res);
        process.exit(0)
      });
     console.log("DDBG SPAWN B");
    `.replace(/\n/g, " "),
      ],
      { stdio: ["pipe", process.stdin, "inherit"] }
    );

    console.log(`DDBG writeToStdin A`);
    console.log(`DDBG writeToStdin B`);

    child.on("error", (err) => {
      console.log(`DDBG ERROR1: ${err}`);
      reject(err);
    });

    child.on("close", (code, signal) => {
      console.log(`DDBG EXIT: code=${code}, signal=${signal}`);
      if (!code && !signal) {
        resolve();
      } else {
        reject(
          new Error(`Child process exited with code=${code}, signal=${signal}`)
        );
      }
    });

    console.log(`DDBG writeToStdin C`);
    await sleep(100);
    console.log(`DDBG writeToStdin D`);

    child.stdin.write(input, (err) => {
      console.log(`DDBG WRITE1: ${err}`);
      if (err) {
        reject(err);
      } else {
        // child.stdin.end();
      }
    });
    console.log(`DDBG writeToStdin E`);
    await sleep(100);
    console.log(`DDBG writeToStdin F`);
  });
}

// The main function remains unchanged
async function main() {
  try {
    console.log("Writing to stdin. Waiting to read the data...");

    // Set up a one-time reader for stdin
    process.stdin.on("data", (data) => {
      console.log(`DDBG main C ${data}`);
      if (data) {
        console.log("Read from stdin:", data.toString().trim());
      }
      // Resume the stdin stream
      process.stdin.resume();
    });

    console.log(`DDBG main B`);
    await writeToStdin("Hello, world!\n");
    console.log(`DDBG main D`);

    // Ensure the process doesn't exit immediately
    setTimeout(() => {
      console.log("Timeout reached. Exiting.");
      process.exit(0);
    }, 1000);
  } catch (error: any) {
    console.error(error.stack);
  }
}

main();
