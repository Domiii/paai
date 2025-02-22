import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { EnvTool, FileTool } from "./base";

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
      .describe(
        "Glob pattern to filter files. If you want to list all files, use '**/*'"
      ),
  });

  protected async _call(
    { globPattern = "**/*" }: { globPattern: string },
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