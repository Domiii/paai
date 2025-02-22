import type EnvTool from "./EnvTool";
import type EnvToolParams from "./EnvToolParams";
export type EnvToolClass = new (params: EnvToolParams) => EnvTool;

import FileReadTool from "./FileReadTool";
import FileWriteTool from "./FileWriteTool";
import DeleteInFileTool from "./DeleteInFileTool";
import SelectWorkspaceTool from "./SelectWorkspaceTool";
import ListFilesTool from "./ListFilesTool";

export const AllToolClasses: EnvToolClass[] = [
  FileReadTool,
  FileWriteTool,
  DeleteInFileTool,
  SelectWorkspaceTool,
  ListFilesTool,
];
