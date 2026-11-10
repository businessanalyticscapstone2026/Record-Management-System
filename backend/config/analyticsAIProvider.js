const PROVIDERS = [
  {
    id: "groq",
    label: "Groq",
    apiKey: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    // Deliberately read only this environment variable. Never fall back to
    // OpenRouter's Default key or any other key name.
    apiKey: () => process.env.OPENROUTER_API_KEY,
    model: () => process.env.OPENROUTER_MODEL || "openrouter/free",
    url: "https://openrouter.ai/api/v1/chat/completions",
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    apiKey: () => process.env.CLOUDFLARE_API_TOKEN,
    model: () => process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    url: () => {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      return accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`
        : null;
    },
  },
];

const providerCooldowns = new Map();
const inFlightRequests = new Map();

function parseProviderJson(raw, expectedKeys) {
  const text = String(raw || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error("Provider returned no usable JSON object.");
    try {
      parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      throw new Error("Provider returned malformed JSON.");
    }
  }
  const insights = parsed?.insights;
  if (!insights || typeof insights !== "object" || Array.isArray(insights)) {
    throw new Error('Provider response must contain an "insights" object.');
  }
  for (const key of expectedKeys) {
    if (typeof insights[key] !== "string" || !insights[key].trim()) {
      throw new Error(`Provider response is missing a valid "${key}" insight.`);
    }
  }
  return insights;
}

function parseRetryDelay(message, headers) {
  const retryAfter = Number(headers?.get?.("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 24 * 60 * 60 * 1000);

  // Groq commonly returns: "Please try again in 3m55.44s".
  const match = String(message || "").match(/try again in\s+(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?/i);
  if (match) {
    const ms = (Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0)) * 1000;
    if (ms > 0) return Math.min(ms + 5000, 24 * 60 * 60 * 1000);
  }
  return null;
}

function setProviderCooldown(provider, response, message) {
  if (response?.status !== 429) return;
  const lower = String(message || "").toLowerCase();
  let delay = parseRetryDelay(message, response.headers);
  if (provider.id === "openrouter" && lower.includes("free-models-per-day")) {
    // This is an account/workspace daily free-model quota, not a bad API key.
    // Pause calls for a day rather than repeatedly spending requests on a known 429.
    delay = 24 * 60 * 60 * 1000;
  }
  if (!delay) delay = provider.id === "groq" ? 5 * 60 * 1000 : 60 * 60 * 1000;
  const until = Date.now() + delay;
  providerCooldowns.set(provider.id, until);
  console.warn(`[Analytics AI] ${provider.label} rate limited; pausing this provider for approximately ${Math.ceil(delay / 60000)} minute(s).`);
}

async function requestProvider(provider, metrics, prompt, expectedKeys, maxTokens) {
  const apiKey = provider.apiKey();
  if (!apiKey) throw new Error("API token is not configured.");
  const endpoint = typeof provider.url === "function" ? provider.url() : provider.url;
  if (!endpoint) throw new Error("Cloudflare account ID is not configured.");

  const controller = new AbortController();
  const timeoutMs = provider.id === "groq" ? 7000 : 20000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider.id === "openrouter" ? {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://www.osca-management.techsite.live",
          "X-Title": "OSCA Record Management System Analytics",
        } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model(),
        messages: [
          {
            role: "system",
            content: `${prompt}\n\nReturn ONLY compact valid JSON, no markdown or prose: {"insights":{"key":"one concise sentence"}}. Include every key exactly once: ${expectedKeys.join(", ")}.`,
          },
          { role: "user", content: JSON.stringify(metrics) },
        ],
        temperature: 0.1,
        ...(provider.id === "groq"
          ? { max_completion_tokens: maxTokens, response_format: { type: "json_object" } }
          : { max_tokens: Math.min(maxTokens, 1600) }),
      }),
    });

    const responseText = await response.text();
    let result = {};
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      if (!response.ok) throw new Error(`HTTP ${response.status}: provider returned an unreadable API response.`);
      throw new Error("Provider returned an unreadable response.");
    }

    if (!response.ok) {
      const cloudflareErrors = Array.isArray(result.errors)
        ? result.errors.map((item) => item?.message || item?.code).filter(Boolean).join("; ")
        : "";
      const message = result.error?.message || result.message || cloudflareErrors || `HTTP ${response.status}`;
      if (provider.id === "cloudflare") {
        console.warn("[Analytics AI] Cloudflare error response:", JSON.stringify({
          status: response.status,
          errors: result.errors || null,
          message: result.message || null,
          model: provider.model(),
          endpoint: endpoint.replace(/accounts\/[^/]+/, "accounts/[account-id]"),
        }).slice(0, 1200));
      }
      setProviderCooldown(provider, response, message);
      throw new Error(`HTTP ${response.status}: ${String(message).slice(0, 500)}`);
    }

    const choice = result.choices?.[0];
    if (choice?.finish_reason === "length") {
      throw new Error(`Provider response reached its completion-token limit (requested budget: ${Math.min(maxTokens, provider.id === "openrouter" ? 1600 : maxTokens)}).`);
    }
    return {
      insights: parseProviderJson(choice?.message?.content || "", expectedKeys),
      provider: provider.id,
      model: result.model || provider.model(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function generateAnalyticsInsightsOnce(metrics, prompt, expectedKeys, maxTokens) {
  const failures = [];
  for (const provider of PROVIDERS) {
    if (!provider.apiKey()) {
      failures.push(`${provider.label}: API key not configured`);
      continue;
    }

    const cooldownUntil = providerCooldowns.get(provider.id) || 0;
    if (cooldownUntil > Date.now()) {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 60000);
      failures.push(`${provider.label}: temporarily paused after rate limit (about ${remaining} minute(s) remaining)`);
      console.info(`[Analytics AI] Skipping ${provider.label}; rate-limit cooldown is active.`);
      continue;
    }
    if (cooldownUntil) providerCooldowns.delete(provider.id);

    try {
      const result = await requestProvider(provider, metrics, prompt, expectedKeys, maxTokens);
      providerCooldowns.delete(provider.id);
      console.info(`[Analytics AI] Successfully generated insights with ${provider.label} using model ${result.model}.`);
      return result;
    } catch (error) {
      const message = error?.name === "AbortError" ? "request timed out" : error.message;
      failures.push(`${provider.label}: ${message}`);
      console.warn(`[Analytics AI] ${provider.label} failed; trying next provider: ${message}`);
    }
  }
  throw new Error(`All analytics AI providers failed. ${failures.join(" | ")}`);
}

async function generateAnalyticsInsights(metrics, prompt, expectedKeys, maxTokens = 2500) {
  // Coalesce simultaneous identical dashboard requests into one provider call.
  const requestKey = JSON.stringify({ metrics, prompt, expectedKeys, maxTokens });
  if (inFlightRequests.has(requestKey)) return inFlightRequests.get(requestKey);

  const request = generateAnalyticsInsightsOnce(metrics, prompt, expectedKeys, maxTokens)
    .finally(() => inFlightRequests.delete(requestKey));
  inFlightRequests.set(requestKey, request);
  return request;
}

module.exports = { generateAnalyticsInsights };
