import { StructuredTool, ToolParams } from "@langchain/core/tools";
import { AgentEnvironment } from "../AgentEnvironment";

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
  verboseParsingErrors = true;

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