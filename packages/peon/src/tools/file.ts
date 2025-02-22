import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { FileTool } from "./base";

const fileEditSchema = z.object({
  filePath: z.string().describe("The relative path of the file"),
  lineFrom: z
    .number()
    .optional()
    .describe("Starting line number (1-based, inclusive)"),
  lineTo: z
    .number()
    .optional()
    .describe("Ending line number (1-based, inclusive)"),
  wordsFrom: z
    .string()
    .optional()
    .describe("First 3+ words of the starting line"),
  wordsTo: z.string().optional().describe("First 3+ words of the ending line"),
});

const fileValidateLineRange = (
  lines: string[],
  lineFrom?: number,
  lineTo?: number
) => {
  const totalLines = lines.length;
  const start = lineFrom ?? 1;
  const end = lineTo ?? totalLines;

  if (start < 1 || start > totalLines) {
    throw new Error(
      `Invalid lineFrom: ${start}. File has ${totalLines} lines.`
    );
  }
  if (end < start || end > totalLines) {
    throw new Error(
      `Invalid lineTo: ${end}. Must be between ${start} and ${totalLines}.`
    );
  }

  return { start, end };
};

const fileValidateWords = (
  lines: string[],
  lineNumber: number,
  words: string
) => {
  const line = lines[lineNumber - 1].trim();
  const lineWords = line.split(/\s+/);
  const expectedWords = words.trim().split(/\s+/);
  const minWords = Math.min(3, expectedWords.length);

  if (!line.startsWith(expectedWords.slice(0, minWords).join(" "))) {
    throw new Error(
      `Mismatch at line ${lineNumber}. Expected "${words}", but found "${lineWords
        .slice(0, minWords)
        .join(" ")}"`
    );
  }
};

const readFileIfExists = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ""; // File doesn't exist, return empty string
    }
    throw error; // Re-throw unexpected errors
  }
};

function fileValidateEditParams(
  lines: string[],
  { lineFrom, lineTo, wordsFrom, wordsTo }: z.infer<typeof fileEditSchema>
) {
  if (
    (lineFrom !== undefined && wordsFrom === undefined) ||
    (lineTo !== undefined && wordsTo === undefined)
  ) {
    throw new Error(
      "If lineFrom/lineTo is given, wordsFrom/wordsTo must also be given respectively."
    );
  }

  const { start, end } = fileValidateLineRange(
    lines,
    lineFrom,
    lineTo ?? lines.length
  );

  if (wordsFrom) fileValidateWords(lines, start, wordsFrom);
  if (wordsTo) fileValidateWords(lines, end, wordsTo);

  return { start, end };
}

export class FileReadTool extends FileTool {
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

export class FileWriteTool extends FileTool {
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
        // If lineFrom and lineTo are not provided, overwrite the entire file.
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content, "utf-8");
        return `✅ File "${filePath}" written successfully`;
      }

      const { start, end } = fileValidateEditParams(existingLines, args);

      // Update the specified range
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

export class DeleteInFileTool extends FileTool {
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

      // If the lines span the whole file, delete the file
      if (start === 1 && end === lines.length) {
        await fs.unlink(filePath);
        return `✅ File "${filePath}" deleted successfully`;
      }

      // Delete the specified range
      const updatedLines = [...lines.slice(0, start - 1), ...lines.slice(end)];

      // Write the updated content back to the file
      await fs.writeFile(filePath, updatedLines.join("\n"), "utf-8");

      return `✅ Lines ${start}-${end} deleted successfully from "${filePath}"`;
    } catch (error: any) {
      throw new Error(
        `❌ Error deleting content from file "${args.filePath}": ${error.message}`
      );
    }
  }
} 