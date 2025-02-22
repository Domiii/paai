import fs from "fs/promises";
import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import FileTool from "./FileTool";
import { fileEditSchema, fileValidateLineRange, fileValidateWords } from "./fileUtils";

export default class FileReadTool extends FileTool {
  description =
    "Read the contents of a file. Each line is prepended with `LINE_NO: `. Optionally specify line range to read.";
  schema = fileEditSchema;

  protected async _call(
    arg: z.infer<typeof this.schema>,
    runManager?: CallbackManagerForToolRun
  ): Promise<string> {
    try {
      const filePath = await this.resolveFile(arg.filePath);
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const { start, end } = fileValidateLineRange(
        lines,
        arg.lineFrom,
        arg.lineTo
      );

      if (arg.wordsFrom) fileValidateWords(lines, start, arg.wordsFrom);
      if (arg.wordsTo) fileValidateWords(lines, end, arg.wordsTo);

      const totalLines = lines.length;
      const paddingWidth = totalLines.toString().length;

      const numberedLines = lines.slice(start - 1, end).map((line, index) => {
        const lineNumber = (start + index)
          .toString()
          .padStart(paddingWidth, "0");
        return `${lineNumber}: ${line}`;
      });

      return numberedLines.join("\n");
    } catch (error: any) {
      throw new Error(
        `❌ Error reading file "${arg.filePath}": ${error.message}`
      );
    }
  }
} 