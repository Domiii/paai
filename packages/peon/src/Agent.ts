import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ToolInterface } from "@langchain/core/tools";
import { ErrorMonitor, ErrorMonitorDeco } from "@paai/shared/util/ErrorMonitor";
import truncate from "lodash/truncate";
import isEmpty from "lodash/isEmpty";

import { AgentEnvironment } from "./AgentEnvironment";
import { AllToolClasses, EnvToolParams } from "./tools";

const unimportantMessages = new Set([
  "on_chain_stream",
  "on_chain_start",
  "on_prompt_start",
  "on_prompt_start",
  "on_prompt_end",
  "on_chat_model_start",
  "on_chat_model_stream",
  "on_chat_model_end",
]);

function instantiateTools(env: AgentEnvironment): ToolInterface[] {
  const sharedParams = new EnvToolParams(env);
  return AllToolClasses.map((ToolClass) => {
    const tool = new ToolClass(sharedParams);
    tool.init(sharedParams);
    return tool;
  });
}

async function createAgent(model: BaseChatModel, tools: ToolInterface[]) {
  const systemMessage = new SystemMessage("Go code or some'in");
  return createReactAgent({
    llm: model,
    tools,
    messageModifier: systemMessage,
  });
}

function visualizeObjectTree(o: any, indent: string = ""): string {
  if (o === null) return "null";
  if (typeof o !== "object") return truncate(String(o), { length: 20 });

  const isArray = Array.isArray(o);
  const prefix = isArray ? "[" : "{";
  const suffix = isArray ? "]" : "}";

  const lines: string[] = [prefix];

  for (const [key, value] of Object.entries(o)) {
    const formattedKey = isArray ? "" : `${key}: `;
    const formattedValue = visualizeObjectTree(value, indent + "  ");
    lines.push(`${indent}  ${formattedKey}${formattedValue},`);
  }

  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1); // Remove trailing comma
  }

  lines.push(`${indent}${suffix}`);

  return lines.join("\n");
}

export class Agent {
  readonly monitor = new ErrorMonitor();

  constructor(public readonly env: AgentEnvironment) {}

  get workspaces() {
    return this.env.workspaces;
  }

  async mutiStepPrompt() {
    // TODO: Take multiple prompts and run them in sequence.
    // TODO: Allow interspersing prompt steps with validation/verification/valuation steps.
    // TODO: Move the prompt (`streamEvents`) loop into their own classes.
    // TODO: Update to latest langchain (0.3+).
  }

  @ErrorMonitorDeco(Agent, "monitor")
  async singlePrompt(
    env: AgentEnvironment,
    model: BaseChatModel,
    promptText: string
  ) {
    const tools = instantiateTools(env);
    const agent = await createAgent(model, tools);

    for await (const event of agent.streamEvents(
      {
        messages: [new HumanMessage(promptText)],
      },
      { version: "v2" }
    )) {
      try {
        this.monitor.addContext(event);

        const kind = event.event;
        if (unimportantMessages.has(kind)) {
          // do nothing.
        } else if (kind === "on_llm_end") {
          console.log("⚙ [on_llm_end]");
        } else if (kind === "on_tool_start") {
          console.log(
            `🔨 [tool_start] [${event.name}]`,
            truncate(JSON.stringify(event.data?.input?.input), { length: 120 })
          );
        } else if (kind === "on_tool_end") {
          console.log(
            `🔨 [tool_end] [${event.name}]`,
            truncate(JSON.stringify(event.data?.output?.content), {
              length: 120,
            })
          );
        } else if (kind === "on_chain_end") {
          const content =
            event.data?.output?.content?.filter((c: any) => c.type == "text") ||
            event.data?.output?.messages?.map((m: any) => m.kwargs) ||
            event.data?.output;
          if (
            content &&
            !content.config?.tags?.includes("langsmith:hidden") &&
            Object.values(content).filter((v) => !isEmpty(v)).length
          ) {
            const contentStr: string = Array.isArray(content)
              ? content
                  .map((c: any) => (c.text as string) || JSON.stringify(c))
                  .join("\n\n")
                  .trim()
              : JSON.stringify(content, null, 2);
            console.log(`🔨 [on_chain_end] ${contentStr}`);
          }
        } else if (kind === "on_agent_finish") {
          console.log(
            `⚙ [on_agent_finish]: ${visualizeObjectTree(event.data)}`
          );
        } else {
          console.log(`⚙ [${kind}]`, visualizeObjectTree(event));
        }
      } catch (err: any) {
        console.error(`❌ Error processing langchain event: ${err.stack}`);
        throw err;
      }
    }
  }
} 