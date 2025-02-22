import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import FileTool from "./FileTool";
import { fileEditSchema, fileValidateEditParams, readFileIfExists } from "./fileUtils";

export default class FileWriteTool extends FileTool {
  description =
    "Write content to a file, optionally specifying line range with word checks";
  schema = fileEditSchema.extend({
    content: z
      .string()
      .describe(
        "The RAW content, written to file as-is. Must not contain LINE_NO."
      ),
  });

  protected async _call(
    args: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const filePath = await this.resolveFile(args.filePath, false);
      const existingContent = await readFileIfExists(filePath);

      const existingLines = existingContent.split("\n");
      const newLines = args.content.split("\n");

      if (args.lineFrom === undefined && args.lineTo === undefined) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content, "utf-8");
        return `✅ File "${filePath}" written successfully`;
      }

      const { start, end } = fileValidateEditParams(existingLines, args);

      const beforeRange = existingLines.slice(0, start - 1);
      const afterRange = existingLines.slice(end);
      const updatedLines = [...beforeRange, ...newLines, ...afterRange];

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, updatedLines.join("\n"), "utf-8");

      return `✅ File "${filePath}" updated successfully (lines ${start}-${end})`;
    } catch (error: any) {
      throw new Error(
        `❌ Error writing file "${args.filePath}": ${error.message}`
      );
    }
  }
} 