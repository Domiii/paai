import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent, AgentExecutor } from "langchain/agents";
import { Tool } from "@langchain/core/tools";
import { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } from "@langchain/core/prompts";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define ModelConfig interface
interface ModelConfig {
  modelName: string;
  temperature?: number;
  maxTokens?: number;
}

// Define a custom tool
class Calculator implements Tool {
  name = "Calculator";
  description = "Useful for performing arithmetic calculations";

  async call(input: string): Promise<string> {
    try {
      return eval(input).toString();
    } catch (error) {
      return "Error: Invalid arithmetic expression";
    }
  }
}

// Model manager class (Singleton)
class ModelManager {
  private static instance: ModelManager;
  private models: Map<string, BaseLanguageModel>;

  private constructor() {
    this.models = new Map();
  }

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  getModel(config: ModelConfig): BaseLanguageModel | undefined {
    return this.models.get(config.modelName);
  }

  createModel(config: ModelConfig): BaseLanguageModel {
    let model: BaseLanguageModel;
    const { modelName, temperature, maxTokens } = config;
    
    if (modelName.startsWith("gpt-")) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OpenAI API key not found in environment variables");
      model = new ChatOpenAI({ modelName, temperature, maxTokens, openAIApiKey: apiKey });
    } else if (modelName.includes("claude")) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("Anthropic API key not found in environment variables");
      model = new ChatAnthropic({ modelName, temperature, maxTokens, anthropicApiKey: apiKey });
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }

    this.models.set(modelName, model);
    return model;
  }
}

// Function to get or create a model
function getOrCreateModel(config: ModelConfig): BaseLanguageModel {
  const modelManager = ModelManager.getInstance();
  let model = modelManager.getModel(config);
  if (!model) {
    model = modelManager.createModel(config);
  }
  return model;
}

// Function to create an agent with a given model
async function createAgent(
  model: BaseLanguageModel,
  tools: Tool[]
): Promise<AgentExecutor> {
  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful AI assistant. Use the tools provided to answer the user's questions."
    ),
    HumanMessagePromptTemplate.fromTemplate(
      "Question: {input}\n\nTools available: {tools}"
    ),
  ]);

  const agent = await createReactAgent({
    llm: model,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
  });
}

// Main function to set up and run the multi-agent system
async function runMultiAgentSystem(model: BaseLanguageModel) {
  // Define tools
  const tools = [new Calculator()];

  // Create the agent
  const agent = await createAgent(model, tools);

  // Example usage
  const result = await agent.invoke({
    input: "What is the result of 15 * 3 + 27?",
  });

  console.log("Agent's response:", result.output);
}

// Usage example
const modelConfig: ModelConfig = {
  modelName: "claude-3-sonnet-20240229",
  temperature: 0.7,
  maxTokens: 1000
};

const model = getOrCreateModel(modelConfig);
runMultiAgentSystem(model);

// To use a different model, you can simply change the modelConfig:
// const openAIConfig: ModelConfig = {
//   modelName: "gpt-3.5-turbo",
//   temperature: 0.5,
//   maxTokens: 500
// };
// const openAIModel = getOrCreateModel(openAIConfig);
// runMultiAgentSystem(openAIModel);