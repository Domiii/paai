import { ToolParams } from "@langchain/core/tools";
import { AgentEnvironment } from "../AgentEnvironment";

export default class EnvToolParams implements ToolParams {
  env: AgentEnvironment;
  verboseParsingErrors?: boolean;

  constructor(env: AgentEnvironment) {
    this.env = env;
  }
} 