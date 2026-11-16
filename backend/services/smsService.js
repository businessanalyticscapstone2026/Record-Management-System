function normalizePhilippineNumber(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");

  if (digits.startsWith("639") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("09") && digits.length === 11) return `+63${digits.slice(1)}`;
  if (digits.startsWith("9") && digits.length === 10) return `+63${digits}`;
  if (digits.startsWith("63") && digits.length === 12) return `+${digits}`;

  throw new Error("Applicant's mobile number is not in a valid Philippine format.");
}

async function sendReadyForReleaseSms({ phone, applicationId }) {
  const secretKey = process.env.UNISMS_SECRET_KEY;
  const senderId = process.env.UNISMS_SENDER_ID || "Unisoft";

  if (!secretKey) throw new Error("UNISMS_SECRET_KEY is not configured.");
  if (!phone || !applicationId) throw new Error("Phone number and application ID are required.");

  const recipient = normalizePhilippineNumber(phone);
  const content =
    "OSCA Bauan: Your Senior Citizen ID is now ready for release. " +
    "You may personally claim it at the OSCA Office or authorize a representative to pick it up on your behalf. Thank you.";

  const credentials = Buffer.from(`${secretKey}:`).toString("base64");
  const response = await fetch("https://unismsapi.com/api/sms", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      recipient,
      content,
      sender_id: senderId,
      metadata: {
        template: "ready_for_release_notification",
        application_id: String(applicationId)
      }
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || result?.error || `UniSMS returned HTTP ${response.status}.`);
  }
  return result;
}

module.exports = { sendReadyForReleaseSms };
