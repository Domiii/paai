import { Workspaces } from "./Workspace";

export class AgentEnvironment {
  private _workspaces = new Workspaces();

  get workspaces(): Workspaces {
    return this._workspaces;
  }
} 