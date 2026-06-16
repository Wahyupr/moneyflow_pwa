/**
 * AI client for daily insights and (later) report insights.
 *
 * Env:
 *   AI_BASE_URL_INSIGHT — base URL (OpenAI-compatible OR Anthropic-compatible)
 *   AI_MODEL_INSIGHT    — model name to use
 *   AI_API_KEY          — bearer/key credential (reused from existing env)
 *
 * Fallbacks (for backward compat) when the new envs are not set:
 *   AI_BASE_URL → AI_BASE_URL_INSIGHT
 *   AI_MODEL    → AI_MODEL_INSIGHT
 *
 * API format auto-detected from URL: if the path contains "anthropic", uses
 * the Anthropic Messages API; otherwise OpenAI Chat Completions.
 */

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatOptions = {
  /** Override the default model. */
  model?: string;
  /** Sampling temperature (0-2). Default 0.4 for consistent structured output. */
  temperature?: number;
  /** Max response tokens. Default 1024. */
  maxTokens?: number;
  /** Abort the request after this many milliseconds. Default 15_000. */
  timeoutMs?: number;
};

export type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number; // Anthropic
  output_tokens?: number; // Anthropic
};

export type ChatResult = {
  content: string;
  model: string;
  usage: TokenUsage | null;
};

const DEFAULT_MODEL = "glm-4.7";

export type InsightClientConfig = {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  format: "openai" | "anthropic";
};

export function getInsightConfig(): InsightClientConfig {
  const baseUrl = (process.env.AI_BASE_URL_INSIGHT ?? process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY ?? process.env.GATEWAY_API_KEY;
  const model = process.env.AI_MODEL_INSIGHT ?? process.env.AI_MODEL ?? DEFAULT_MODEL;
  const format: "openai" | "anthropic" = /\/anthropic/i.test(baseUrl) ? "anthropic" : "openai";
  return { apiKey, baseUrl, model, format };
}

export function isInsightConfigured(): boolean {
  const { apiKey, baseUrl } = getInsightConfig();
  return Boolean(apiKey && baseUrl);
}

/**
 * Calls the insight AI endpoint. Throws on network errors, non-2xx responses,
 * or empty content. Callers must catch and fall back to a deterministic
 * template insight so the dashboard always shows *something*.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ChatResult> {
  const config = getInsightConfig();
  if (!config.apiKey || !config.baseUrl) {
    throw new Error("Insight AI is not configured.");
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result =
      config.format === "anthropic"
        ? await callAnthropic(config, messages, options, controller.signal)
        : await callOpenAI(config, messages, options, controller.signal);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  config: InsightClientConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  signal: AbortSignal
): Promise<ChatResult> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? config.model,
      stream: false,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 1024,
      messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Insight AI error ${response.status}: ${errorText.slice(0, 200) || response.statusText}`
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: TokenUsage;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Insight AI returned empty content.");
  }

  return {
    content,
    model: options.model ?? config.model,
    usage: payload.usage ?? null
  };
}

async function callAnthropic(
  config: InsightClientConfig,
  messages: ChatMessage[],
  options: ChatOptions,
  signal: AbortSignal
): Promise<ChatResult> {
  // Anthropic Messages API expects system as a top-level field, not in
  // messages[]. Extract any leading system message and forward the rest.
  const systemMessage = messages.find((m) => m.role === "system");
  const userAssistant = messages.filter((m) => m.role !== "system");

  const response = await fetch(`${config.baseUrl}/v1/messages`, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey ?? "",
      authorization: `Bearer ${config.apiKey}`,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: options.model ?? config.model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.4,
      system: systemMessage?.content,
      messages: userAssistant.map((m) => ({ role: m.role, content: m.content }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Insight AI error ${response.status}: ${errorText.slice(0, 200) || response.statusText}`
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: TokenUsage;
    model?: string;
  };

  const textBlock = payload.content?.find((b) => b.type === "text");
  const content = textBlock?.text;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Insight AI returned empty content.");
  }

  const usage = payload.usage
    ? {
        prompt_tokens: payload.usage.input_tokens,
        completion_tokens: payload.usage.output_tokens,
        total_tokens:
          (payload.usage.input_tokens ?? 0) + (payload.usage.output_tokens ?? 0),
        input_tokens: payload.usage.input_tokens,
        output_tokens: payload.usage.output_tokens
      }
    : null;

  return {
    content,
    model: payload.model ?? options.model ?? config.model,
    usage
  };
}

/**
 * Strips Markdown fences and parses JSON. Throws if content is invalid JSON.
 */
export function parseJsonResponse<T = unknown>(content: string): T {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned) as T;
}
