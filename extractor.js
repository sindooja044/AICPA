
function firstMatch(text, regex) {
  const m = text.match(regex);
  if (!m) return null;
  for (let i = m.length - 1; i > 0; i--) {
    if (m[i]) return m[i].toString().trim();
  }
  return null;
}

function toNumber(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[^\d.]+/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function extractFieldsFromText(rawText) {
  const text = (rawText || "").replace(/\r/g, "\n");

  function matchField(label) {
    const regex = new RegExp(label + "\\s*:\\s*([^\\n\\.]+)", "i");
    const m = text.match(regex);
    return m ? m[1].trim() : null;
  }

  const out = {
    policyNumber: matchField("Policy Number"),
    policyholderName: matchField("Policyholder"),
    claimant: matchField("Claimant"),

    incidentDate: (() => {
      const m = text.match(/Incident on\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i);
      return m ? m[1] : null;
    })(),

    incidentTime: (() => {
      const m = text.match(/at\s*([0-9]{1,2}\s*[APMapm]{2})/i);
      return m ? m[1] : null;
    })(),

    incidentLocation: (() => {
      const m = text.match(/in\s*([A-Za-z ]+)/i);
      return m ? m[1].trim() : null;
    })(),

    description: matchField("Description"),

    estimatedDamage: (() => {
      const m = text.match(/Estimated Damage\s*:\s*([0-9]+)/i);
      return m ? Number(m[1]) : null;
    })(),

    claimType: matchField("Claim Type"),

    attachments: matchField("Attachment"),

    effectiveDates: null,
    thirdParties: null,
    contactDetails: null,
    assetType: null,
    assetID: null,
    initialEstimate: matchField("Estimated Damage")
  };

  return out;
}


module.exports = { extractFieldsFromText };
