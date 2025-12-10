/**
 * decideRoute(extracted, missingFields)
 * Implements rules from assignment:
 * - If any mandatory field is missing -> Manual Review
 * - If description contains fraud/staged/inconsistent -> Investigation Flag
 * - If claimType == injury -> Specialist Queue
 * - If estimatedDamage < 25000 -> Fast-track
 * - else Standard Queue
 *
 * returns { recommendedRoute, reasoning }
 */
function decideRoute(extracted, missingFields) {
  const reasons = [];

  if (missingFields && missingFields.length > 0) {
    reasons.push(`Mandatory fields missing: ${missingFields.join(', ')}`);
    return { recommendedRoute: 'Manual Review', reasoning: reasons.join('; ') };
  }

  const description = (extracted.description || '').toLowerCase();
  if (/\b(fraud|fraudulent|inconsistent|staged)\b/.test(description)) {
    reasons.push('Description contains potential fraud indicators (fraud/inconsistent/staged).');
    return { recommendedRoute: 'Investigation Flag', reasoning: reasons.join('; ') };
  }

  if ((extracted.claimType || '').toLowerCase() === 'injury' || /injury|bodily injury|hospital/i.test(description)) {
    reasons.push('Claim type is injury (requires specialist).');
    return { recommendedRoute: 'Specialist Queue', reasoning: reasons.join('; ') };
  }

  const estimate = Number(extracted.initialEstimate ?? extracted.estimatedDamage ?? 0);
  if (Number.isFinite(estimate) && estimate < 25000 && estimate > 0) {
    reasons.push(`Estimated damage ${estimate} is below 25,000 → Fast-track.`);
    return { recommendedRoute: 'Fast-track', reasoning: reasons.join('; ') };
  }

  reasons.push('No rule triggered: route to Standard Queue.');
  return { recommendedRoute: 'Standard Queue', reasoning: reasons.join('; ') };
}

module.exports = { decideRoute };
