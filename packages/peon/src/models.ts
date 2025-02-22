import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface ModelConfig {
  modelName: string;
  temperature?: number;
  maxOutputTokens?: number;
}

enum Provider {
  OPENAI = "OPENAI",
  ANTHROPIC = "ANTHROPIC",
  OLLAMA = "OLLAMA"
}

class ModelManager {
  private static instance: ModelManager;
  private models: Map<string, BaseChatModel>;

  private constructor() {
    this.models = new Map();
  }

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  getModel(config: ModelConfig): BaseChatModel | undefined {
    return this.models.get(JSON.stringify(config));
  }

  private getProvider(modelName: string): Provider {
    if (modelName.startsWith("gpt-")) {
      return Provider.OPENAI;
    } else if (modelName.includes("claude")) {
      return Provider.ANTHROPIC;
    } else if (modelName.includes("llama") || modelName.includes("yi:")) {
      return Provider.OLLAMA;
    } else {
      throw new Error(`Unsupported model: ${modelName}`);
    }
  }

  private getApiKey(provider: Provider): string {
    if (provider === Provider.OLLAMA) return ""; // Ollama doesn't need an API key
    const envVar = `PERSONAL_${provider}_API_KEY`;
    const apiKey = process.env[envVar];
    if (!apiKey) {
      throw new Error(`${envVar} not found in environment variables`);
    }
    return apiKey;
  }

  public createModel(config: ModelConfig): BaseChatModel {
    const provider = this.getProvider(config.modelName);
    const apiKey = this.getApiKey(provider);

    const { modelName, temperature, maxOutputTokens: maxTokens } = config;

    let model: BaseChatModel;
    switch (provider) {
      case Provider.OPENAI:
        model = new ChatOpenAI({
          modelName,
          temperature,
          maxTokens,
          openAIApiKey: apiKey,
        });
        break;
      case Provider.ANTHROPIC:
        model = new ChatAnthropic({
          modelName,
          temperature,
          maxTokens,
          anthropicApiKey: apiKey,
        });
        break;
      case Provider.OLLAMA:
        model = new ChatOllama({
          baseUrl: "http://localhost:11434",
          model: modelName || "yi:9b-chat",
          temperature,
        });
        break;
    }

    this.models.set(JSON.stringify(config), model);
    return model;
  }
}

export function getOrCreateModel(config: ModelConfig): BaseChatModel {
  const modelManager = ModelManager.getInstance();
  let model = modelManager.getModel(config);
  if (!model) {
    model = modelManager.createModel(config);
  }
  return model;
} 