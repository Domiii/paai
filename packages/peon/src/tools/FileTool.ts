import EnvTool from "./EnvTool";

export default abstract class FileTool extends EnvTool {
  protected async resolveFile(
    relativePath: string,
    checkAccess: boolean = true
  ): Promise<string> {
    const currentWorkspace = this.env.workspaces.currentWorkspace;
    if (!currentWorkspace) {
      throw new Error("No current workspace selected");
    }
    return currentWorkspace.resolveFile(relativePath, checkAccess);
  }
} 