const CARD_KEYS = ["production", "barangay", "aging", "monthly"];
const { generateAnalyticsInsights } = require("../config/analyticsAIProvider");
const INSIGHT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const insightCache = new Map();

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getCachedInsights(key) {
  const entry = insightCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    insightCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheInsights(key, value) {
  insightCache.set(key, { value, expiresAt: Date.now() + INSIGHT_CACHE_TTL_MS });
}

function containsPersonalDataKey(value) {
  const sensitiveKeys = new Set([
    "id", "applicationid", "applicant", "applicantname", "name",
    "firstname", "middlename", "surname", "address", "dob",
    "dateofbirth", "gender", "photo", "signature", "controlno",
  ]);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    sensitiveKeys.has(key.toLowerCase().replace(/[-_]/g, "")) ||
    containsPersonalDataKey(child)
  );
}

const ALLOWED_CARD_FIELDS = {
  production: ["hasData", "previousPeriodComparison", "total", "active", "queued", "inProduction", "completed", "queuedPercent", "productionPercent", "completedPercent", "queuedElevatedThresholdPercent", "statusLabel", "expectedLead", "fallback"],
  barangay: ["hasData", "previousPeriodComparison", "total", "ranking", "topThreePercent", "elevatedThresholdPercent", "statusLabel", "expectedLead", "fallback"],
  aging: ["hasData", "previousPeriodComparison", "active", "within24", "within24Percent", "from24To48", "from24To48Percent", "over48", "over48Percent", "oldestAge", "unknownTimestamps", "thresholdsHours", "elevatedThresholdPercent", "highThresholdPercent", "statusLabel", "expectedLead", "fallback"],
  monthly: ["hasData", "months", "latestMonth", "latestCount", "previousMonth", "previousCount", "comparison", "previousPeriodComparison", "completedTotal", "monthCount", "averagePerMonth", "completedWithoutTimestamp", "elevatedWhenLatestBelowPrevious", "statusLabel", "expectedLead", "fallback"],
};

function sanitizeCardStats(cardKey, input) {
  if (!plainObject(input)) return {};
  const sanitized = {};
  for (const field of ALLOWED_CARD_FIELDS[cardKey]) {
    if (!(field in input)) continue;
    const value = input[field];

    if (field === "ranking") {
      sanitized.ranking = Array.isArray(value) ? value.slice(0, 3).map((entry) => ({
        barangay: String(entry?.barangay || "").slice(0, 100),
        count: Number.isFinite(entry?.count) ? entry.count : null,
        percent: Number.isFinite(entry?.percent) ? entry.percent : null,
      })) : [];
    } else if (field === "months") {
      sanitized.months = Array.isArray(value) ? value.slice(0, 12).map((entry) => ({
        label: String(entry?.label || "").slice(0, 30),
        count: Number.isFinite(entry?.count) ? entry.count : null,
      })) : [];
    } else if (field === "previousPeriodComparison") {
      sanitized.previousPeriodComparison = cardKey === "monthly" && plainObject(value)
        ? {
            latestMonth: String(value.latestMonth || "").slice(0, 30),
            latestCount: Number.isFinite(value.latestCount) ? value.latestCount : null,
            previousMonth: String(value.previousMonth || "").slice(0, 30),
            previousCount: Number.isFinite(value.previousCount) ? value.previousCount : null,
            direction: String(value.direction || "").slice(0, 20),
          }
        : null;
    } else if (field === "thresholdsHours") {
      sanitized.thresholdsHours = Array.isArray(value) ? value.slice(0, 2).filter(Number.isFinite) : [];
    } else if (["expectedLead", "fallback", "oldestAge", "latestMonth", "previousMonth", "statusLabel", "comparison"].includes(field)) {
      sanitized[field] = value == null ? null : String(value).slice(0, field === "fallback" ? 800 : 180);
    } else if (field === "hasData" || field === "elevatedWhenLatestBelowPrevious") {
      sanitized[field] = value === true;
    } else if (value === null) {
      sanitized[field] = null;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[field] = value;
    } else {
      sanitized[field] = null;
    }
  }
  return sanitized;
}

function sanitizeCards(input) {
  if (!plainObject(input)) throw new Error("Computed card statistics are required.");
  return Object.fromEntries(CARD_KEYS.map((key) => [key, sanitizeCardStats(key, input[key])]));
}

function fallbackInsight(cardKey, stats = {}) {
  if (typeof stats.fallback === "string" && stats.fallback.trim()) return stats.fallback.trim();

  const n = (key) => Number.isFinite(stats[key]) ? stats[key].toLocaleString() : "0";
  const text = {
    production: `The queue has ${n("queued")} queued records out of ${n("total")} total, while ${n("inProduction")} are in production and ${n("completed")} are completed and ready for release to staff. Prioritize checking queued records that have not entered production and confirm that each stage is receiving timely status updates.`,
    barangay: `${n("total")} records are represented across the leading barangay groups. Check the ranking for areas carrying the largest share of the workload and coordinate production batches so heavily represented barangays do not remain unattended.`,
    aging: `${n("over48")} of ${n("active")} active records have exceeded 48 hours, compared with ${n("within24")} within 24 hours and ${n("from24To48")} between 24 and 48 hours. Review the oldest overdue records first and verify the last queue update before moving them to the next stage.`,
    monthly: `${n("completedTotal")} IDs were completed across ${n("monthCount")} months. Compare the latest month with the previous month when both are available; if output has fallen, review production capacity and identify which stage needs follow-up.`,
  };
  return text[cardKey] || "Analytics data is available for this panel.";
}

function numericTokens(value, output = new Set()) {
  if (typeof value === "number" && Number.isFinite(value)) {
    output.add(String(value));
  } else if (typeof value === "string") {
    for (const match of value.matchAll(/\d[\d,]*(?:\.\d+)?%?/g)) {
      output.add(match[0].replaceAll(",", "").replace(/%$/, ""));
    }
  } else if (Array.isArray(value)) {
    value.forEach((entry) => numericTokens(entry, output));
  } else if (plainObject(value)) {
    Object.values(value).forEach((entry) => numericTokens(entry, output));
  }
  return output;
}

function validateInsight(text, stats) {
  if (typeof text !== "string") return "response was not text";
  const candidate = text.trim();
  if (!candidate || candidate.length > 1000) return "response was empty or too long";

  const nums = candidate.match(/\d[\d,]*(?:\.\d+)?%?/g) || [];
  const allowed = numericTokens(stats);
  const unsupported = nums.find((value) =>
    !allowed.has(value.replaceAll(",", "").replace(/%$/, ""))
  );
  return unsupported ? `response introduced an unsupported number: ${unsupported}` : null;
}

async function generateIdMakerAnalyticsInsights(req, res) {
  try {
    if (!plainObject(req.body?.cards)) {
      return res.status(400).json({ success: false, message: "Computed card statistics are required." });
    }
    if (JSON.stringify(req.body.cards).length > 16000) {
      return res.status(413).json({ success: false, message: "Analytics statistics payload is too large." });
    }
    if (containsPersonalDataKey(req.body.cards)) {
      return res.status(400).json({ success: false, message: "Personal applicant fields are not allowed in analytics insight requests." });
    }

    const metrics = sanitizeCards(req.body.cards);
    const cacheKey = JSON.stringify(metrics);
    const cached = getCachedInsights(cacheKey);
    if (cached) {
      return res.json({ success: true, configured: true, cached: true, insights: cached });
    }

    const prompt = "You are an operational analytics advisor for an OSCA ID Maker queue dashboard. For each analytics key (production, barangay, aging, monthly), do more than restate the chart: interpret the pattern, identify a concrete operational concern or useful opportunity when supported by the metrics, explain its likely workflow impact without guessing at causes, and recommend a specific practical next action. Write exactly one concise sentence per insight, maximum 22 words; do not add a heading. Give urgent attention to large backlogs, records exceeding aging thresholds, concentrated barangay workloads, and changes in monthly ID output when the supplied data supports those conclusions. Recommend reviewing the oldest records, checking stalled status updates, following up with the responsible workflow stage, or monitoring output trends only when relevant to the supplied metrics. Use only the supplied aggregate statistics. Do not invent numbers, infer unsupported causes, identify individuals, or make eligibility decisions. If a metric does not indicate a problem, provide a useful takeaway and a suitable monitoring action. Use clear, professional, simple English.";
    const result = await generateAnalyticsInsights(metrics, prompt, CARD_KEYS, 900);
    const generated = result.insights;
    const provider = result.provider;

    const insights = {};
    for (const key of CARD_KEYS) {
      const candidate = typeof generated[key] === "string" ? generated[key].trim() : "";
      const validationFailure = candidate ? validateInsight(candidate, metrics[key]) : "AI did not return an insight";
      insights[key] = candidate && !validationFailure
        ? { text: candidate, source: provider }
        : { text: fallbackInsight(key, metrics[key]), source: "fallback", ...(validationFailure ? { reason: validationFailure } : {}) };
    }

    if (Object.values(insights).every((item) => ["groq", "cerebras", "openrouter"].includes(item.source))) {
      cacheInsights(cacheKey, insights);
    }
    return res.json({ success: true, configured: true, provider, model: result.model, insights });
  } catch (error) {
    console.warn(`[ID Maker analytics] Multi-provider decision-support insight generation failed: ${error.message}`);
    try {
      const metrics = sanitizeCards(req.body?.cards || {});
      const insights = Object.fromEntries(CARD_KEYS.map((key) => [
        key, { text: fallbackInsight(key, metrics[key]), source: "fallback" },
      ]));
      return res.json({
        success: true,
        configured: Boolean(process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY || process.env.OPENROUTER_API_KEY || process.env.CLOUDFLARE_API_TOKEN),
        insights,
      });
    } catch (_) {
      return res.status(500).json({ success: false, message: "Unable to generate ID Maker analytics insights." });
    }
  }
}

module.exports = {
  generateIdMakerAnalyticsInsights,
  containsPersonalDataKey,
  sanitizeCardStats,
};
