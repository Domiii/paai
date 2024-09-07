import fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import ignore, { Ignore } from "ignore";

import { ChatAnthropic } from "@langchain/anthropic";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import {
  ToolInterface,
  ToolParams,
  DynamicStructuredTool,
  tool,
  StructuredTool,
} from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createReactAgent } from "langchain/agents";

import { z } from "zod";
import { RunnableConfig } from "@langchain/core/runnables";

export interface ModelConfig {
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

export class Workspace {
  private _absolutePath: string;
  private _label: string;

  constructor(absolutePath: string, label: string) {
    this._absolutePath = absolutePath;
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

  async enumerateFiles(globPattern: string): Promise<string[]> {
    const options = {
      cwd: this._absolutePath,
      nodir: true,
      dot: true,
      absolute: true,
      ignore: ["**/.git/**", "**/node_modules/**"],
    };

    const files = await glob(globPattern, options);

    const ig = await this.getGitignoreRules();

    const nonIgnoredFiles = files.filter((file) => {
      const relativePath = path.relative(this._absolutePath, file);
      return !ig.ignores(relativePath);
    });

    return nonIgnoredFiles.map((file) =>
      path.relative(this._absolutePath, file)
    );
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

  get workspaces(): Map<string, Workspace> {
    return this._workspaces;
  }

  get currentWorkspaceId(): string | undefined {
    return this._currentWorkspaceId;
  }

  set currentWorkspaceId(id: string | undefined) {
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

  get name() {
    return this.constructor.name.replaceAll("Tool", "");
  }

  init(params: EnvToolParams) {
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
      this.env.workspaces.currentWorkspaceId = workspaceId;
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
  SelectWorkspaceTool,
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
  private models: Map<string, BaseLanguageModel>;

  private constructor() {
    this.models = new Map();
  }

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  getModel(config: ModelConfig): BaseLanguageModel | undefined {
    return this.models.get(config.modelName);
  }

  createModel(config: ModelConfig): BaseLanguageModel {
    let model: BaseLanguageModel;
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

    this.models.set(modelName, model);
    return model;
  }
}

// Function to get or create a model
function getOrCreateModel(config: ModelConfig): BaseLanguageModel {
  const modelManager = ModelManager.getInstance();
  let model = modelManager.getModel(config);
  if (!model) {
    model = modelManager.createModel(config);
  }
  return model;
}

// Function to create an agent with a given model
async function createAgent(
  model: BaseLanguageModel,
  tools: ToolInterface[]
): Promise<AgentExecutor> {
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful AI assistant. Use the tools provided to answer the user's questions."
    ),
    HumanMessagePromptTemplate.fromTemplate(
      "Question: {input}\n\nTools available: {tools}"
    ),
  ]);

  const agent = await createReactAgent({
    llm: model,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
  });
}

// Main function to set up and run the multi-agent system
async function runPrompt(
  env: AgentEnvironment,
  model: BaseLanguageModel,
  input: string
) {
  // Define tools
  const tools: ToolInterface[] = instantiateTools(env, AllToolClasses);

  // Create the agent
  const agent = await createAgent(model, tools);

  for await (const event of agent.streamEvents(
    {
      input,
    },
    { version: "v2" }
  )) {
    // event.data.output.usage_metadata, // undefined
    // event.data.output.response_metadata, // { prompt: 0, completion: 0 }
    const tokenUsage = event.data.output.llmOutput?.tokenUsage;
    if (tokenUsage) {
      usageStats.promptTokens += tokenUsage.promptTokens || 0;
      usageStats.completionTokens += tokenUsage.completionTokens || 0;
      usageStats.totalTokens += tokenUsage.totalTokens || 0;
    }
    if (event.event === "on_llm_start") {
      console.log("LLM started");
    } else if (event.event === "on_llm_end") {
    } else if (event.event === "on_tool_start") {
      console.log("Tool started:", event.data.tool);
    } else if (event.event === "on_tool_end") {
      console.log("Tool ended:", event.data.output);
    } else if (event.event === "on_agent_finish") {
      console.log("Agent finished with final response:", event.data.returnValues.output);
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
  const peonPath = path.resolve(__dirname, "..");
  env.workspaces.addWorkspace(peonPath);
  await runPrompt(env, model, "What classes are in index.ts?");
}
main();
