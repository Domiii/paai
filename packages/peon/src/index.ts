import dotenv from "dotenv";
import path from "path";

import { MONOREPO_ROOT_DIR, PEON_ROOT_DIR } from "./paths";
import { readUserPromptFile } from "./prompts";
import { Agent } from "./Agent";
import { AgentEnvironment } from "./AgentEnvironment";
import { ModelConfig, getOrCreateModel } from "./models";

// Load .secret.env file
dotenv.config({ path: path.resolve(MONOREPO_ROOT_DIR, ".secret.env") });

export { Agent } from "./Agent";
export { AgentEnvironment } from "./AgentEnvironment";
export { ModelConfig, getOrCreateModel } from "./models";
export * from "./tools";

const modelConfig: ModelConfig = {
  modelName: "claude-3-sonnet-20240229",
  temperature: 0,
  maxOutputTokens: 1024, // NOTE: Anthropic's max is 4k
};

/** ###########################################################################
 * Observability
 * ##########################################################################*/

// monkey-patch process.exit
const processExit = process.exit;
process.exit = (...args: any[]) => {
  console.trace("Exiting...");
  return processExit(...args) as never;
};

// Handle unhandled exceptions
process.on("unhandledRejection", (error: any) => {
  console.error(`❌ Unhandled promise rejection: ${error?.stack || error}`);
  process.exit(1);
});

process.on("uncaughtException", (error: any) => {
  console.error(`❌ Uncaught exception: ${error?.stack || error}`);
  process.exit(1);
});


/** ###########################################################################
 * Main
 * ##########################################################################*/

async function main() {
  const model = getOrCreateModel(modelConfig);
  const env = new AgentEnvironment();
  // Add paai-peon as the only workspace.
  env.workspaces.addWorkspace(PEON_ROOT_DIR);
  env.workspaces.setCurrentWorkspace(PEON_ROOT_DIR);
  const prompt = await readUserPromptFile();
  const agent = new Agent(env);
  await agent.singlePrompt(env, model, prompt);
}

if (require.main === module) {
  main().catch((error: any) => {
    console.error(`❌ MAIN FAILURE: ${error?.stack || error}`);
  });
}