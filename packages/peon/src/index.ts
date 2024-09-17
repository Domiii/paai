import dotenv from "dotenv";
import fs from "fs/promises";
import { glob } from "glob";
import ignore, { Ignore } from "ignore";
import path from "path";

import { ChatAnthropic } from "@langchain/anthropic";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import {
  StructuredTool,
  ToolInterface,
  ToolParams,
} from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import truncate from "lodash/truncate";
import isEmpty from "lodash/isEmpty";

// Load .secret.env file
dotenv.config({ path: path.resolve(MONOREPO_ROOT_DIR, ".secret.env") });

import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ErrorMonitorDeco } from "./util/ErrorMonitor";
import { pathNormalized, pathNormalizedForce } from "./util/pathUtil";
import { MONOREPO_ROOT_DIR, PEON_ROOT_DIR } from "./paths";
import { readUserPromptFile } from "./prompts";

export interface ModelConfig {
  modelName: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export class Workspace {
  private _absolutePath: string;
  private _label: string;

  constructor(absolutePath: string, label: string) {
    this._absolutePath = pathNormalizedForce(absolutePath);
    this._label = label;
  }

  get absolutePath(): string {
    return this._absolutePath;
  }

  get label(): string {
    return this._label;
  }

  async resolveFile(
    relativePath: string,
    checkAccess: boolean = true
  ): Promise<string> {
    const fullPath = path.resolve(this._absolutePath, relativePath);

    // Resolve the real path, following symlinks
    // NOTE: we might not be able to use realpath here because the file might not exist yet.
    const realFullPath = checkAccess ? await fs.realpath(fullPath) : fullPath;
    const realBasePath = await fs.realpath(this._absolutePath);
    if (!realFullPath.startsWith(realBasePath)) {
      throw new Error(
        `Path traversal attack detected. ${fullPath} is not a child of ${this._absolutePath}`
      );
    }

    if (checkAccess) {
      // Check if the file exists and is readable
      await fs.access(realFullPath, fs.constants.R_OK);
    }
    return realFullPath;
  }

  async enumerateFiles(globPattern: string = "**/*"): Promise<string[]> {
    const options = {
      cwd: this._absolutePath,
      nodir: true,
      dot: true,
      absolute: false,
      posix: true,
      ignore: ["**/.git/**", "**/node_modules/**"],
    };

    const files = (await glob(globPattern, options)) || [];

    // console.log(
    //   `DDBG files "${this._absolutePath}" on "${globPattern}": ${files.join(",")}`
    // );

    const ig = await this.getGitignoreRules();

    const nonIgnoredFiles = files.filter((relativePath) => {
      return !ig.ignores(relativePath);
    });

    return nonIgnoredFiles;
  }

  private async getGitignoreRules(): Promise<Ignore> {
    const ig = ignore();
    let currentPath = this._absolutePath;

    while (true) {
      const gitignorePath = path.join(currentPath, ".gitignore");
      let gitignoreContent = "";
      try {
        gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      } catch (error) {
        // If .gitignore doesn't exist, we'll just continue
      }

      const gitignorePatterns = gitignoreContent
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
      ig.add(gitignorePatterns);

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        // We've reached the root directory
        break;
      }
      currentPath = parentPath;
    }

    return ig;
  }
}

export class Workspaces {
  private _workspaces = new Map<string, Workspace>();
  private _currentWorkspaceId: string | undefined;

  get currentWorkspace(): Workspace | undefined {
    return this._currentWorkspaceId
      ? this._workspaces.get(this._currentWorkspaceId)
      : undefined;
  }

  get workspaces(): Map<string, Workspace> {
    return this._workspaces;
  }

  get currentWorkspaceId(): string | undefined {
    return this._currentWorkspaceId;
  }

  addWorkspace(fpath: string): void {
    const label = path.basename(fpath);
    if (this._workspaces.has(label)) {
      throw new Error(
        `NYI: Workspace label "${label}" at "${path}" already exists. Need to implement a unique label generation strategy.`
      );
    }
    const workspace = new Workspace(fpath, label);
    this._workspaces.set(label, workspace);
  }

  setCurrentWorkspace(idOrPath: string) {
    let id: string | undefined;
    if (idOrPath) {
      idOrPath = pathNormalized(idOrPath);
      if (idOrPath.includes("/")) {
        id = idOrPath.split("/").pop();
      } else {
        id = idOrPath;
      }
    }
    return this.setCurrentWorkspaceId(id);
  }

  setCurrentWorkspaceId(id: string | undefined) {
    if (!id) {
      // Unset the current workspace
      this._currentWorkspaceId = undefined;
    } else {
      if (!this._workspaces.has(id)) {
        throw new Error(`invalid workspace id: ${id}`);
      }
      this._currentWorkspaceId = id;
    }
  }
}

const unimportantMessages = new Set([
  "on_chain_stream",
  "on_chain_start",
  "on_prompt_start",
  "on_prompt_start",
  "on_prompt_end",
  "on_chat_model_start",
  "on_chat_model_stream",
  "on_chat_model_end",
]);

export class AgentEnvironment {
  private _workspaces = new Workspaces();

  constructor() {}

  get workspaces(): Workspaces {
    return this._workspaces;
  }

  @ErrorMonitorDeco()
  async runPrompt(
    env: AgentEnvironment,
    model: BaseChatModel,
    promptText: string
  ) {
    // Define tools
    const tools: ToolInterface[] = instantiateTools(env, AllToolClasses);

    // Create the agent
    const agent = await createAgent(model, tools);

    for await (const event of agent.streamEvents(
      {
        messages: [new HumanMessage(promptText)],
      },
      { version: "v2" }
    )) {
      try {
        // console.log(`DDBG streamEvents: ${visualizeObjectTree(event)}`);

        // TODO: tokenUsage
        // const tokenUsage = event.data.output.llmOutput?.tokenUsage;
        // if (tokenUsage) {
        //   usageStats.promptTokens += tokenUsage.promptTokens || 0;
        //   usageStats.completionTokens += tokenUsage.completionTokens || 0;
        //   usageStats.totalTokens += tokenUsage.totalTokens || 0;
        // }
        const kind = event.event;
        // console.debug(
        //   `[event:${event.event}] ${JSON.stringify(event, null, 2)}`
        // );
        // if (kind === "on_llm_start") {
        //   console.log("LLM started");
        // }
        if (unimportantMessages.has(kind)) {
          // do nothing.
        } else if (kind === "on_llm_end") {
          console.log("⚙ [on_llm_end]");
        } else if (kind === "on_tool_start") {
          console.log(
            `🔨 [tool_start] [${event.name}]`,
            truncate(JSON.stringify(event.data?.input?.input), { length: 120 })
          );
        } else if (kind === "on_tool_end") {
          // WARNING: This does not get called on unsuccessful tool calls.
          //          Instead, "error" (onToolError) should get emitted, but it does not seem to work.
          console.log(
            `🔨 [tool_end] [${event.name}]`,
            truncate(JSON.stringify(event.data?.output?.content), {
              length: 120,
            })
          );
        } else if (kind === "on_chain_end") {
          // console.log("🔨 Chain ended:", event.data?.output);
          const content =
            event.data?.output?.content?.filter((c: any) => c.type == "text") ||
            event.data?.output?.messages?.map((m: any) => m.kwargs) ||
            event.data?.output;
          if (
            content &&
            Object.values(content).filter((v) => !isEmpty(v)).length
          ) {
            const contentStr: string = Array.isArray(content)
              ? content
                  .map((c: any) => (c.text as string) || JSON.stringify(c))
                  .join("\n\n")
                  .trim()
              : JSON.stringify(content, null, 2);
            console.log(
              `🔨 [on_chain_end] ${contentStr}`
              // ${content
              //   .map((c: any) => c.text || )
              //   )}`
            );
          }
        } else if (kind === "on_agent_finish") {
          console.log(
            `⚙ [on_agent_finish]: ${visualizeObjectTree(event.data)}`
          );
        } else {
          console.log(`⚙ [${kind}]`, visualizeObjectTree(event));
        }
      } catch (err: any) {
        // WARNING: Don't remove this. We add this console.error because streamEvent swallows exceptions.
        console.error(`❌ Error processing langchain event: ${err.stack}`);
        throw err;
      }
    }
  }
}

export class EnvToolParams implements ToolParams {
  env: AgentEnvironment;
  verboseParsingErrors?: boolean;

  constructor(env: AgentEnvironment) {
    this.env = env;
  }
}

export abstract class EnvTool extends StructuredTool {
  env!: AgentEnvironment;
  name!: string;

  init(params: EnvToolParams) {
    this.name = this.constructor.name.replaceAll("Tool", "");
    this.env = params.env;
  }
}

export type EnvToolClass = new (params: EnvToolParams) => EnvTool;

export abstract class FileTool extends EnvTool {
  protected async resolveFile(
    relativePath: string,
    checkAccess: boolean = true
  ): Promise<string> {
    const currentWorkspace = this.env.workspaces.currentWorkspace;
    if (!currentWorkspace) {
      throw new Error("No current workspace selected");
    }
    return currentWorkspace.resolveFile(relativePath, checkAccess);
  }
}

/**
 * File read tool for reading file contents.
 */
export class FileReadTool extends FileTool {
  description = "Read the contents of a file";
  schema = z.object({
    relativePath: z.string().describe("The relative path of the file to read"),
  });

  protected async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const filePath = await this.resolveFile(arg.relativePath);
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error: any) {
      throw new Error(
        `❌ Error reading file "${arg.relativePath}": ${error.stack}`
      );
    }
  }
}

/**
 * File write tool for writing content to a file.
 */
export class FileWriteTool extends FileTool {
  description = "Write content to a file";
  schema = z.object({
    filePath: z.string().describe("The relative path of the file to write"),
    content: z.string().describe("The content to write to the file"),
  });

  protected async _call(
    { filePath, content }: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      filePath = await this.resolveFile(filePath, false);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf-8");
      return `✅ File "${filePath}" written successfully`;
    } catch (error: any) {
      throw new Error(`❌ Error writing file "${filePath}": ${error.stack}`);
    }
  }
}

export class SelectWorkspaceTool extends EnvTool {
  description = "Select a workspace to work in";
  schema = z.object({
    workspaceId: z
      .string()
      .describe("Unique id of the workspace. Usually its folder name."),
  });

  protected async _call(
    { workspaceId }: { workspaceId: string },
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      this.env.workspaces.setCurrentWorkspaceId(workspaceId);
      return `✅ Workspace "${workspaceId}" selected`;
    } catch (error: any) {
      throw new Error(`❌ Error selecting workspace: ${error.stack}`);
    }
  }
}

export class ListFilesTool extends FileTool {
  description =
    "List files in the current workspace, respecting all .gitignore files in the ancestry and with a 500 file limit";
  schema = z.object({
    globPattern: z
      .string()
      .optional()
      .describe("Glob pattern to filter files. Default is '*'"),
  });

  protected async _call(
    { globPattern = "*" }: { globPattern: string },
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const currentWorkspace = this.env.workspaces.currentWorkspace;
      if (!currentWorkspace) {
        throw new Error("No current workspace selected");
      }

      const files = await currentWorkspace.enumerateFiles(globPattern);

      if (files.length > 500) {
        throw new Error(
          "Found more than 500 files. Please use a more specific glob pattern."
        );
      }

      return files.join("\n");
    } catch (error: any) {
      throw new Error(`❌ Error listing files: ${error.stack}`);
    }
  }
}

export const AllToolClasses: EnvToolClass[] = [
  FileReadTool,
  FileWriteTool,
  // SelectWorkspaceTool,
  ListFilesTool,
];

function instantiateTools(
  env: AgentEnvironment,
  ToolClasses: EnvToolClass[]
): EnvTool[] {
  const sharedParams = { env };
  return ToolClasses.map((ToolClass) => {
    const tool = new ToolClass(new EnvToolParams(env));
    tool.init(sharedParams);
    return tool;
  });
}

enum Provider {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
}

// Model manager class (Singleton)
class ModelManager {
  private static instance: ModelManager;
  private models: Map<string, BaseChatModel>;

  private constructor() {
    this.models = new Map();
  }

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  getModel(config: ModelConfig): BaseChatModel | undefined {
    return this.models.get(JSON.stringify(config));
  }

  private getProvider(modelName: string): Provider {
    if (modelName.startsWith("gpt-")) {
      return Provider.OPENAI;
    } else if (modelName.includes("claude")) {
      return Provider.ANTHROPIC;
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }
  }

  private getApiKey(provider: Provider): string {
    // TODO: Support juggling mutliple conflicting keys.
    const envVar = `PERSONAL_${provider}_API_KEY`;
    const apiKey = process.env[envVar];
    if (!apiKey) {
      throw new Error(`${envVar} not found in environment variables`);
    }
    return apiKey;
  }

  public createModel(config: ModelConfig): BaseChatModel {
    const provider = this.getProvider(config.modelName);
    const apiKey = this.getApiKey(provider);

    const { modelName, temperature, maxOutputTokens: maxTokens } = config;

    let model: BaseChatModel;
    switch (provider) {
      case Provider.OPENAI:
        model = new ChatOpenAI({
          modelName,
          temperature,
          maxTokens,
          openAIApiKey: apiKey,
        });
        break;
      case Provider.ANTHROPIC:
        model = new ChatAnthropic({
          modelName,
          temperature,
          maxTokens,
          anthropicApiKey: apiKey,
        });
        break;
    }

    this.models.set(JSON.stringify(config), model);
    return model;
  }
}

// Function to get or create a model
function getOrCreateModel(config: ModelConfig): BaseChatModel {
  const modelManager = ModelManager.getInstance();
  let model = modelManager.getModel(config);
  if (!model) {
    model = modelManager.createModel(config);
  }
  return model;
}

// Function to create an agent with a given model
async function createAgent(model: BaseChatModel, tools: ToolInterface[]) {
  // TODO: Create separate agent classes with different system prompts and tools.
  const systemMessage = new SystemMessage("Go code or some'in");
  return createReactAgent({
    llm: model,
    tools,
    messageModifier: systemMessage,
  });
}

function visualizeObjectTree(o: any, indent: string = ""): string {
  if (o === null) return "null";
  if (typeof o !== "object") return truncate(String(o), { length: 20 });

  const isArray = Array.isArray(o);
  const prefix = isArray ? "[" : "{";
  const suffix = isArray ? "]" : "}";

  const lines: string[] = [prefix];

  for (const [key, value] of Object.entries(o)) {
    const formattedKey = isArray ? "" : `${key}: `;
    const formattedValue = visualizeObjectTree(value, indent + "  ");
    lines.push(`${indent}  ${formattedKey}${formattedValue},`);
  }

  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1); // Remove trailing comma
  }

  lines.push(`${indent}${suffix}`);

  return lines.join("\n");
}

const modelConfig: ModelConfig = {
  modelName: "claude-3-sonnet-20240229",
  temperature: 0,
  maxOutputTokens: 1024, // NOTE: Anthropic's max is 4k
};

async function main() {
  const model = getOrCreateModel(modelConfig);
  const env = new AgentEnvironment();
  // Add paai-peon as the only workspace.
  env.workspaces.addWorkspace(PEON_ROOT_DIR);
  env.workspaces.setCurrentWorkspace(PEON_ROOT_DIR);
  const prompt = await readUserPromptFile();
  await env.runPrompt(env, model, prompt);
}

if (require.main === module) {
  main().catch((error: any) => {
    console.error(`❌ MAIN FAILURE: ${error?.stack || error}`);
  });
}

// monkey-patch process.exit
process.exit = (...args: any[]) => {
  console.trace("Exiting...");
  process.exit(...args);
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

// setInterval(() => {}, 1 << 30);

// import * as readline from 'readline';
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });
// console.log('Press Enter to exit...');
// rl.question('', () => {
//   console.log('Exiting...');
//   rl.close();
//   process.exit(0);
// });
