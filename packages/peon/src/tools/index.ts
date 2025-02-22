export * from "./base";
export * from "./file";
export * from "./workspace";

import { EnvToolClass } from "./base";
import { FileReadTool, FileWriteTool, DeleteInFileTool } from "./file";
import { SelectWorkspaceTool, ListFilesTool } from "./workspace";

export const AllToolClasses: EnvToolClass[] = [
  FileReadTool,
  FileWriteTool,
  DeleteInFileTool,
  SelectWorkspaceTool,
  ListFilesTool,
]; 