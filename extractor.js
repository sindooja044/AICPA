require('dotenv').config();
const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY || '';

let openaiClient = null;
if (OPENAI_KEY) {
  const OpenAI = require('openai');
  openaiClient = new OpenAI({ apiKey: OPENAI_KEY });
}

/**
 * Main exported function
 */
async function extractFieldsFromText(text) {
  const t = (text || '').replace(/\r/g, '\n');

  // Try OpenAI if configured
  if (openaiClient) {
    try {
      const prompt = `Extract the following fields from the text between triple backticks.
Return only a JSON object with keys exactly:
policyNumber, policyholderName, effectiveDates, incidentDate, incidentTime,
incidentLocation, description, claimant, thirdParties, contactDetails,
assetType, assetID, estimatedDamage, claimType, attachments, initialEstimate.

Text:
\`\`\`
${t.slice(0, 30000)}
\`\`\`
If a field is missing, use empty string.`;

      const resp = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0
      });

      const outText = resp.choices?.[0]?.message?.content?.trim();
      if (outText) {
        const jsonStart = outText.indexOf('{');
        const jsonEnd = outText.lastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd >= 0) {
          const maybe = outText.slice(jsonStart, jsonEnd + 1);
          try {
            const parsed = JSON.parse(maybe);
            return normalizeExtracted(parsed);
          } catch (e) {
            console.warn('OpenAI returned non-JSON or parse failed, falling back to heuristics.');
          }
        }
      }
    } catch (err) {
      console.warn('OpenAI extraction failed:', err.message || err);
    }
  }

  // fallback to heuristics
  return normalizeExtracted(heuristicExtract(t));
}

function normalizeExtracted(raw) {
  const parsed = {
    policyNumber: raw.policyNumber || raw.policy_number || findPolicyNumber(raw.text || '') || null,
    policyholderName: raw.policyholderName || raw.policyholder || raw.policy_holder || null,
    effectiveDates: raw.effectiveDates || raw.effective_dates || raw.effective || null,
    incidentDate: raw.incidentDate || raw.incident_date || raw.date || null,
    incidentTime: raw.incidentTime || raw.incident_time || raw.time || null,
    incidentLocation: raw.incidentLocation || raw.location || null,
    description: raw.description || raw.desc || raw.details || null,
    claimant: raw.claimant || raw.claimantName || raw.claimant_name || null,
    thirdParties: raw.thirdParties || raw.third_parties || raw.third || null,
    contactDetails: raw.contactDetails || raw.contact_details || raw.contact || null,
    assetType: raw.assetType || raw.asset_type || null,
    assetID: raw.assetID || raw.asset_id || raw.asset || null,
    estimatedDamage: normalizeNumber(raw.estimatedDamage || raw.estimated_damage || raw.estimate || raw.initialEstimate || raw.initial_estimate || ''),
    claimType: (raw.claimType || raw.claim_type || raw.type || '') ? String(raw.claimType || raw.claim_type || raw.type).toLowerCase() : null,
    attachments: (typeof raw.attachments !== 'undefined' ? raw.attachments : null),
    initialEstimate: normalizeNumber(raw.initialEstimate || raw.initial_estimate || raw.estimate || raw.estimatedDamage || '')
  };

  Object.keys(parsed).forEach(k => {
    if (parsed[k] === '' || parsed[k] === undefined) parsed[k] = null;
  });

  return parsed;
}

function normalizeNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).replace(/[, ]+/g, '').replace(/[^0-9.]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function heuristicExtract(text) {
  const out = {};

  // policy number
  const policyMatch = text.match(/policy\s*(?:no|number|#|id)[:\-\s]*([A-Z0-9\-\/]{3,40})/i);
  if (policyMatch) out.policyNumber = policyMatch[1].trim();

  // policyholder
  const nameMatch = text.match(/(?:policyholder|insured|insured name|policy holder|name)[:\-\s]{1,}([A-Z][A-Za-z\.\s,'-]{2,120})/i);
  if (nameMatch) out.policyholderName = nameMatch[1].trim();

  // effective dates (simple)
  const effMatch = text.match(/effective\s*(?:dates|date|from)[\s:\-]*([0-9]{1,2}[\-\/\.][0-9]{1,2}[\-\/\.][0-9]{2,4}(?:\s*(?:to|-)\s*[0-9]{1,2}[\-\/\.][0-9]{1,2}[\-\/\.][0-9]{2,4})?)/i);
  if (effMatch) out.effectiveDates = effMatch[1].trim();

  // incident date (dd/mm/yyyy or yyyy-mm-dd)
  const dateMatch = text.match(/(0?[1-9]|[12][0-9]|3[01])[\/\-.](0?[1-9]|1[012])[\/\-.](\d{2,4})/);
  if (dateMatch) out.incidentDate = dateMatch[0];

  // time
  const timeMatch = text.match(/([01]?\d|2[0-3]):[0-5]\d(\s?[APMapm]{2})?/);
  if (timeMatch) out.incidentTime = timeMatch[0];

  // location
  const locMatch = text.match(/location[:\-\s]{1,}([A-Z0-9][\w\s,.'-]{3,200})/i);
  if (locMatch) out.incidentLocation = locMatch[1].split('\n')[0].trim();

  // description
  const descMatch = text.match(/description[:\-\s]*([\s\S]{20,1000})/i);
  if (descMatch) out.description = descMatch[1].split(/\n{2,}|\n---/)[0].trim();

  // claimant
  const claimantMatch = text.match(/(claimant|reported by|claimant name)[:\-\s]+([A-Z][a-zA-Z\s,'-]{2,120})/i);
  if (claimantMatch) out.claimant = claimantMatch[2].trim();

  // contact details
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(\+?\d{1,3}[-\s]?)?(\d{6,12})/);
  out.contactDetails = (emailMatch ? emailMatch[0] : '') + (phoneMatch ? (emailMatch ? ' / ' + phoneMatch[0] : phoneMatch[0]) : '');

  // asset type/id
  const assetTypeMatch = text.match(/asset\s*(type)?[:\-\s]*([A-Za-z0-9\-\s]{3,50})/i);
  if (assetTypeMatch) out.assetType = assetTypeMatch[2].trim();

  const assetIdMatch = text.match(/(asset id|asset #|asset serial|vehicle reg(istration)?|registration number)[:\-\s]*([A-Z0-9\-\/]{3,40})/i);
  if (assetIdMatch) out.assetID = assetIdMatch[2].trim();

  // estimates
  const estimateMatch = text.match(/(estimated damage|initial estimate|damage estimate|estimate)[:\-\s]*([^\n]+)/i);
  if (estimateMatch) {
    out.estimatedDamage = extractNumberFromString(estimateMatch[2]);
    out.initialEstimate = out.estimatedDamage;
  } else {
    const moneyMatch = text.match(/(?:Rs\.?|INR|\$|€|£)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d+)?)/);
    if (moneyMatch) out.estimatedDamage = extractNumberFromString(moneyMatch[0]);
  }

  // claim type inference
  const typeMatch = text.match(/claim\s*type[:\-\s]*([a-zA-Z]{3,30})/i);
  if (typeMatch) out.claimType = typeMatch[1].trim().toLowerCase();
  else {
    if (/injury|bodily injury|hospital/i.test(text)) out.claimType = 'injury';
    else if (/vehicle|car|motorbike|truck/i.test(text)) out.claimType = out.claimType || 'vehicle';
    else if (/property|house|building/i.test(text)) out.claimType = out.claimType || 'property';
  }

  // attachments
  const attMatch = /attachments?[:\-\s]*([^\n]+)/i.exec(text);
  if (attMatch) out.attachments = attMatch[1].trim();
  else if (/attached/i.test(text)) out.attachments = 'attached';

  // third parties
  const thirdMatch = text.match(/third[-\s]?party[:\-\s]*([A-Z][\w\s,.'-]{2,120})/i);
  if (thirdMatch) out.thirdParties = thirdMatch[1].trim();

  out.text = text;
  return out;
}

function extractNumberFromString(s) {
  if (!s) return null;
  const cleaned = String(s).replace(/[, ]+/g, '').replace(/[^\d.]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function findPolicyNumber(text) {
  const m = text.match(/([A-Z]{2,6}[-\/\s]?\d{3,8})/i);
  return m ? m[1] : null;
}

module.exports = { extractFieldsFromText };
