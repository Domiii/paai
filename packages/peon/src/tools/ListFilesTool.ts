import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import FileTool from "./FileTool";

export default class ListFilesTool extends FileTool {
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