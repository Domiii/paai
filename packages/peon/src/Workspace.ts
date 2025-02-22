import fs from "fs/promises";
import { glob } from "glob";
import ignore, { Ignore } from "ignore";
import path from "path";
import { pathNormalizedForce } from "@paai/shared/util/pathUtil";

export class Workspace {
  private _absolutePath: string;
  private _label: string;

  constructor(absolutePath: string, label: string) {
    this._absolutePath = pathNormalizedForce(absolutePath);
    this._label = label;
  }

  get absolutePath(): string {
    return this._absolutePath;
  }

  get label(): string {
    return this._label;
  }

  async resolveFile(
    relativePath: string,
    checkAccess: boolean = true
  ): Promise<string> {
    const fullPath = path.resolve(this._absolutePath, relativePath);

    const realFullPath = checkAccess ? await fs.realpath(fullPath) : fullPath;
    const realBasePath = await fs.realpath(this._absolutePath);
    if (!realFullPath.startsWith(realBasePath)) {
      throw new Error(
        `Path traversal attack detected. ${fullPath} is not a child of ${this._absolutePath}`
      );
    }

    if (checkAccess) {
      await fs.access(realFullPath, fs.constants.R_OK);
    }
    return realFullPath;
  }

  async enumerateFiles(globPattern: string = "**/*"): Promise<string[]> {
    const options = {
      cwd: this._absolutePath,
      nodir: true,
      dot: true,
      absolute: false,
      posix: true,
      ignore: ["**/.git/**", "**/node_modules/**"],
    };

    if (!globPattern.startsWith("/") && !globPattern.startsWith("**")) {
      globPattern = `**/${globPattern}`;
    }

    const files = (await glob(globPattern, options)) || [];
    const ig = await this.getGitignoreRules();

    const nonIgnoredFiles = files.filter((relativePath) => {
      return !ig.ignores(relativePath);
    });

    return nonIgnoredFiles;
  }

  private async getGitignoreRules(): Promise<Ignore> {
    const ig = ignore();
    let currentPath = this._absolutePath;

    while (true) {
      const gitignorePath = path.join(currentPath, ".gitignore");
      let gitignoreContent = "";
      try {
        gitignoreContent = await fs.readFile(gitignorePath, "utf8");
      } catch (error) {
        // If .gitignore doesn't exist, we'll just continue
      }

      const gitignorePatterns = gitignoreContent
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
      ig.add(gitignorePatterns);

      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break;
      }
      currentPath = parentPath;
    }

    return ig;
  }
}

export class Workspaces {
  private _workspaces = new Map<string, Workspace>();
  private _currentWorkspaceId: string | undefined;

  get currentWorkspace(): Workspace | undefined {
    return this._currentWorkspaceId
      ? this._workspaces.get(this._currentWorkspaceId)
      : undefined;
  }

  get workspaces(): Map<string, Workspace> {
    return this._workspaces;
  }

  get currentWorkspaceId(): string | undefined {
    return this._currentWorkspaceId;
  }

  addWorkspace(fpath: string): void {
    const label = path.basename(fpath);
    if (this._workspaces.has(label)) {
      throw new Error(
        `NYI: Workspace label "${label}" at "${path}" already exists. Need to implement a unique label generation strategy.`
      );
    }
    const workspace = new Workspace(fpath, label);
    this._workspaces.set(label, workspace);
  }

  setCurrentWorkspace(idOrPath: string) {
    let id: string | undefined;
    if (idOrPath) {
      idOrPath = pathNormalizedForce(idOrPath);
      if (idOrPath.includes("/")) {
        id = idOrPath.split("/").pop();
      } else {
        id = idOrPath;
      }
    }
    return this.setCurrentWorkspaceId(id);
  }

  setCurrentWorkspaceId(id: string | undefined) {
    if (!id) {
      this._currentWorkspaceId = undefined;
    } else {
      if (!this._workspaces.has(id)) {
        throw new Error(`invalid workspace id: ${id}`);
      }
      this._currentWorkspaceId = id;
    }
  }
} 