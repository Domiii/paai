import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import ignore, { Ignore } from "ignore";
import dotenv from "dotenv";

import { ChatAnthropic } from "@langchain/anthropic";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import {
  ToolInterface,
  ToolParams,
  StructuredTool,
} from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import truncate from "lodash/truncate";

// Load .secret.env file
dotenv.config({ path: path.resolve(__dirname, "..", ".secret.env") });

import { z } from "zod";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  pathNormalized,
  pathNormalizedForce,
  pathRelative,
} from "./util/pathUtil";

export interface ModelConfig {
  modelName: string;
  temperature?: number;
  maxTokens?: number;
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

  async resolveFile(relativePath: string): Promise<string> {
    const fullPath = path.resolve(this._absolutePath, relativePath);

    // Resolve the real path, following symlinks
    const realFullPath = await fs.realpath(fullPath);
    const realBasePath = await fs.realpath(this._absolutePath);
    if (!realFullPath.startsWith(realBasePath)) {
      throw new Error(
        `Path traversal attack detected. ${fullPath} is not a child of ${this._absolutePath}`
      );
    }

    // Check if the file exists and is readable
    await fs.access(realFullPath, fs.constants.R_OK);
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

    const files = ((await glob(globPattern, options)) || []);

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

export class AgentEnvironment {
  private _workspaces = new Workspaces();

  constructor() {}

  get workspaces(): Workspaces {
    return this._workspaces;
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
  protected async resolveFile(relativePath: string): Promise<string> {
    const currentWorkspace = this.env.workspaces.currentWorkspace;
    if (!currentWorkspace) {
      throw new Error("No current workspace selected");
    }
    return currentWorkspace.resolveFile(relativePath);
  }
}

/**
 * File read tool for reading file contents.
 */
export class FileReadToolClass extends FileTool {
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
        `❌ Error reading file "${arg.relativePath}": ${error.message}`
      );
    }
  }
}

/**
 * File write tool for writing content to a file.
 */
export class FileWriteToolClass extends FileTool {
  description = "Write content to a file";
  schema = z.object({
    filePath: z.string().describe("The relative path of the file to write"),
    content: z.string().describe("The content to write to the file"),
  });

  protected async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const resolvedPath = await this.resolveFile(arg.filePath);
      await fs.writeFile(resolvedPath, arg.content, "utf-8");
      return `✅ File "${arg.filePath}" written successfully`;
    } catch (error: any) {
      throw new Error(
        `❌ Error writing file "${arg.filePath}": ${error.message}`
      );
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
      throw new Error(`❌ Error selecting workspace: ${error.message}`);
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
      throw new Error(`❌ Error listing files: ${error.message}`);
    }
  }
}

export const AllToolClasses: EnvToolClass[] = [
  FileReadToolClass,
  FileWriteToolClass,
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

  createModel(config: ModelConfig): BaseChatModel {
    let model: BaseChatModel;
    const { modelName, temperature, maxTokens } = config;

    if (modelName.startsWith("gpt-")) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey)
        throw new Error("OPENAI_API_KEY not found in environment variables");
      model = new ChatOpenAI({
        modelName,
        temperature,
        maxTokens,
        openAIApiKey: apiKey,
      });
    } else if (modelName.includes("claude")) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey)
        throw new Error("ANTHROPIC_API_KEY not found in environment variables");
      model = new ChatAnthropic({
        modelName,
        temperature,
        maxTokens,
        anthropicApiKey: apiKey,
      });
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
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
  // TODO: Create agent classes
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

// Main function to set up and run the multi-agent system
export async function runPrompt(
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
    // console.log(`DDBG streamEvents: ${visualizeObjectTree(event)}`);
    
    // TODO: tokenUsage
    // const tokenUsage = event.data.output.llmOutput?.tokenUsage;
    // if (tokenUsage) {
    //   usageStats.promptTokens += tokenUsage.promptTokens || 0;
    //   usageStats.completionTokens += tokenUsage.completionTokens || 0;
    //   usageStats.totalTokens += tokenUsage.totalTokens || 0;
    // }
    const kind = event.event;
    // if (kind === "on_llm_start") {
    //   console.log("LLM started");
    // } else
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
      console.log(
        `🔨 [tool_end] [${event.name}]`,
        truncate(JSON.stringify(event.data?.output?.content), { length: 120 })
      );
    } else if (kind === "on_chain_end") {
      // console.log("🔨 Chain ended:", event.data?.output);
      const content = event.data?.output?.content?.filter(
        (c: any) => c.type == "text"
      );
      if (content) {
        console.log(
          `🔨 [on_chain_end] ${content
            .map((c: any) => c.text)
            .join("\n\n")
            .trim()}`
        );
      }
    } else if (kind === "on_agent_finish") {
      console.log(`⚙ [on_agent_finish]: ${visualizeObjectTree(event.data)}`);
    } else {
      console.log(`⚙ [${kind}]`, visualizeObjectTree(event));
    }
  }
}

// Usage example
const modelConfig: ModelConfig = {
  modelName: "claude-3-sonnet-20240229",
  temperature: 0.7,
  maxTokens: 1000,
};

async function main() {
  const model = getOrCreateModel(modelConfig);
  const env = new AgentEnvironment();

  // Add paai-peon as the only workspace.
  const peonPath = path.resolve(__dirname, "..");
  env.workspaces.addWorkspace(peonPath);
  env.workspaces.setCurrentWorkspace(peonPath);
  await runPrompt(env, model, "What classes are in index.ts?");
}

if (require.main === module) {
  main();
}
