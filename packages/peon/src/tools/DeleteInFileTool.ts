import fs from "fs/promises";
import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import FileTool from "./FileTool";
import { fileEditSchema, fileValidateEditParams } from "./fileUtils";

export default class DeleteInFileTool extends FileTool {
  description =
    "Delete content from a file, optionally specifying line range with word checks";
  schema = fileEditSchema;

  protected async _call(
    args: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const filePath = await this.resolveFile(args.filePath, true);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      const { start, end } = fileValidateEditParams(lines, args);

      if (start === 1 && end === lines.length) {
        await fs.unlink(filePath);
        return `✅ File "${filePath}" deleted successfully`;
      }

      const updatedLines = [...lines.slice(0, start - 1), ...lines.slice(end)];

      await fs.writeFile(filePath, updatedLines.join("\n"), "utf-8");

      return `✅ Lines ${start}-${end} deleted successfully from "${filePath}"`;
    } catch (error: any) {
      throw new Error(
        `❌ Error deleting content from file "${args.filePath}": ${error.message}`
      );
    }
  }
} 