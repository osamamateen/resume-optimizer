import type { AiProvider } from "./types";
import { ClaudeProvider } from "./providers/claude";
import { OpenRouterProvider } from "./providers/openrouter";

export function getAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "claude";
  switch (provider) {
    case "claude":
      return new ClaudeProvider();
    case "openrouter":
      return new OpenRouterProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER: "${provider}"`);
  }
}
