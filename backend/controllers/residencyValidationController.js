const supabase = require("../config/supabase");
const { generateAnalyticsInsights } = require("../config/analyticsAIProvider");

const BAUAN_BARANGAYS = [
  "Alagao", "Aplaya", "As-Is", "Bagong Silang", "Baguilawa", "Balayong",
  "Barangay I", "Barangay II", "Barangay III", "Barangay IV", "Bolo", "Colvo",
  "Cupang", "Durungao", "Gulibay", "Inicbulan", "Locloc", "Magalang-Galang",
  "Malindig", "Manalupong", "Manghinao Proper", "Manghinao Uno", "New Danglayan",
  "Orense", "Pitugo", "Rizal", "Sampaguita", "San Agustin", "San Andres Proper",
  "San Andres Uno", "San Diego", "San Miguel", "San Pablo", "San Pedro",
  "San Roque", "San Teodoro", "San Vicente", "Santa Maria", "Santo Domingo", "Sinala"
];

const ALIASES = new Map([
  ["as is", "As-Is"],
  ["brgy i", "Barangay I"], ["barangay 1", "Barangay I"], ["poblacion i", "Barangay I"],
  ["brgy ii", "Barangay II"], ["barangay 2", "Barangay II"], ["poblacion ii", "Barangay II"],
  ["brgy iii", "Barangay III"], ["barangay 3", "Barangay III"], ["poblacion iii", "Barangay III"],
  ["brgy iv", "Barangay IV"], ["barangay 4", "Barangay IV"], ["poblacion iv", "Barangay IV"],
  ["magalang galang", "Magalang-Galang"],
  ["manalupang", "Manalupong"],
  ["manghinao i", "Manghinao Uno"],
  ["manghinao 1", "Manghinao Uno"],
  ["san andres i", "San Andres Uno"],
  ["san andres 1", "San Andres Uno"],
  ["sta maria", "Santa Maria"],
  ["sto domingo", "Santo Domingo"]
]);

function normalizeBarangay(value) {
  let normalized = String(value || "").toLowerCase().trim()
    .replace(/^barangay\s+/i, "")
    .replace(/^brgy\.?\s*/i, "")
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
  if (ALIASES.has(normalized)) return ALIASES.get(normalized);
  const match = BAUAN_BARANGAYS.find((name) =>
    name.toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ") === normalized
  );
  return match || null;
}

function parseAiDecision(raw) {
  try {
    const parsed = JSON.parse(String(raw || "").trim());
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

async function validateResidency(req, res) {
  try {
    const applicationId = String(req.params.applicationId || "").trim();
    if (!applicationId) {
      return res.status(400).json({ success: false, message: "Application ID is required." });
    }

    // Only locality fields are selected. Applicant names, exact house numbers,
    // street details, contact information, and uploaded documents are not sent to AI.
    const { data: application, error } = await supabase
      .from("applications")
      .select("application_id, barangay_district, house_street")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) throw error;
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found." });
    }

    const barangayInput = String(application.barangay_district || "").trim();
    const addressText = String(application.house_street || "");
    const addressMentionsBauan = /\bbauan\b/i.test(addressText);
    const addressMentionsBatangas = /\bbatangas\b/i.test(addressText);
    if (!barangayInput || barangayInput === "—") {
      return res.json({
        success: true,
        residency: {
          status: "manual_review", resident: null, confidence: 0,
          matchedBarangay: null, provider: "rule-based",
          explanation: "Barangay information is missing. OSCA staff must verify the applicant's residence."
        }
      });
    }

    const prompt = [
      "You are an address-locality assistant for OSCA Bauan, Batangas.",
      "Determine whether the supplied barangay name is one of the official 40 barangays of Bauan, Batangas.",
      "Use the supplied official list as the sole authority. Normalize common spelling, abbreviation, punctuation, and numbering variations.",
      "Do not infer residency from a street address. Do not invent a barangay match.",
      "If a clear match exists, decision must be resident and matchedBarangay must be the exact canonical list name.",
      "If the input clearly names a different municipality or barangay and is not a Bauan barangay, decision may be non_resident.",
      "If uncertain, return manual_review. Never use confidence alone to approve.",
      "Return JSON only using this exact wrapper: {\\"insights\\":{\\"residency\\":\\"{\\\\\\"decision\\\\\\":\\\\\\"resident|non_resident|manual_review\\\\\\",\\\\\\"matchedBarangay\\\\\\":\\\\\\"canonical name or null\\\\\\",\\\\\\"confidence\\\\\\":0.0,\\\\\\"explanation\\\\\\":\\\\\\"one short sentence\\\\\\"}\\"}}. The residency value must be a JSON-encoded string."
    ].join(" ");

    const payload = {
      suppliedBarangay: barangayInput.slice(0, 100),
      addressMentionsBauan,
      addressMentionsBatangas,
      officialBauanBarangays: BAUAN_BARANGAYS
    };

    let ai = null;
    let provider = "rule-based-fallback";
    try {
      const generated = await generateAnalyticsInsights(
        payload,
        prompt,
        ["residency"],
        500
      );
      ai = parseAiDecision(generated.insights.residency);
      provider = generated.provider;
    } catch (aiError) {
      console.warn("[Residency AI] Provider unavailable; using conservative barangay matching:", aiError.message);
    }

    const exactMatch = normalizeBarangay(barangayInput);
    let residency;

    // Never accept a model-invented barangay. A resident result requires a
    // canonical official barangay match, independent of the model's confidence.
    const aiMatch = normalizeBarangay(ai?.matchedBarangay);
    const aiConfidence = Number(ai?.confidence) || 0;
    const confirmedMatch = exactMatch || (ai?.decision === "resident" && aiMatch && aiConfidence >= 0.85 ? aiMatch : null);

    if (confirmedMatch) {
      residency = {
        status: "resident",
        resident: true,
        confidence: exactMatch ? 1 : Math.min(Number(ai?.confidence) || 0, 0.99),
        matchedBarangay: confirmedMatch,
        provider,
        explanation: exactMatch
          ? `The barangay "${confirmedMatch}" is included in the official list of Bauan barangays.`
          : String(ai?.explanation || "The barangay matches an official Bauan barangay.")
      };
    } else {
      residency = {
        status: "manual_review",
        resident: null,
        confidence: Math.max(0, Math.min(1, Number(ai?.confidence) || 0)),
        matchedBarangay: null,
        provider,
        explanation: String(ai?.explanation || "The barangay could not be confidently matched to Bauan's official barangay list. OSCA staff must verify the address.")
      };
    }

    return res.json({ success: true, residency });
  } catch (error) {
    console.error("[Residency validation] Failed:", error);
    return res.status(500).json({
      success: false,
      message: "Residency validation could not be completed. Please retry or verify manually."
    });
  }
}

module.exports = { validateResidency, normalizeBarangay, BAUAN_BARANGAYS };
