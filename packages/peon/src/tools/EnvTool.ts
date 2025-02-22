import { StructuredTool } from "@langchain/core/tools";
import { AgentEnvironment } from "../AgentEnvironment";
import EnvToolParams from "./EnvToolParams";

export default abstract class EnvTool extends StructuredTool {
  env!: AgentEnvironment;
  name!: string;
  verboseParsingErrors = true;

  init(params: EnvToolParams) {
    this.name = this.constructor.name.replaceAll("Tool", "");
    this.env = params.env;
  }
} 