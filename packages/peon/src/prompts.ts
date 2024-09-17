import fs from "fs/promises";
import { getAssetPath } from "./AssetManager";
import NestedError from "./util/NestedError";

export function getPromptPath(promptName: string): string {
  return getAssetPath(`prompts/${promptName}.md`);
}

export async function readUserPromptFile(): Promise<string> {
  const USER_PROMPT_FILE_NAME = "user_prompt";
  const promptPath = getPromptPath(USER_PROMPT_FILE_NAME);
  try {
    return await fs.readFile(promptPath, "utf-8");
  } catch (error: any) {
    throw new NestedError(`Error reading prompt file`, error);
  }
}
