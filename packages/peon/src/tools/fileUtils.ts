import { z } from "zod";
import fs from "fs/promises";

export const fileEditSchema = z.object({
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

export const fileValidateLineRange = (
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

export const fileValidateWords = (
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

export const readFileIfExists = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ""; 
    }
    throw error;
  }
};

export const fileValidateEditParams = (
  lines: string[],
  { lineFrom, lineTo, wordsFrom, wordsTo }: z.infer<typeof fileEditSchema>
) => {
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
}; 