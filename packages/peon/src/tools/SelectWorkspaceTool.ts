import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import EnvTool from "./EnvTool";

export default class SelectWorkspaceTool extends EnvTool {
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