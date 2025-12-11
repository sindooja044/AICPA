function decideRoute(extracted, missingFields) {
  if (missingFields && missingFields.length > 0) {
    return { recommendedRoute: "Manual Review", reasoning: `Mandatory fields missing: ${missingFields.join(", ")}` };
  }

  const desc = (extracted.description || "").toLowerCase();
  if (/\b(fraud|fraudulent|inconsistent|staged)\b/.test(desc)) {
    return { recommendedRoute: "Investigation Flag", reasoning: "Description contains potential fraud indicators (fraud/inconsistent/staged)." };
  }

  if ((extracted.claimType || "").toLowerCase() === "injury" || /injury|bodily injury|hospital/i.test(desc)) {
    return { recommendedRoute: "Specialist Queue", reasoning: "Claim type is injury (requires specialist)." };
  }

  const estimate = Number(extracted.initialEstimate ?? extracted.estimatedDamage ?? 0);
  if (Number.isFinite(estimate) && estimate > 0 && estimate < 25000) {
    return { recommendedRoute: "Fast-track", reasoning: `Estimated damage ${estimate} is below 25,000 → Fast-track.` };
  }

  return { recommendedRoute: "Standard Queue", reasoning: "No rule triggered: route to Standard Queue." };
}

module.exports = { decideRoute };
