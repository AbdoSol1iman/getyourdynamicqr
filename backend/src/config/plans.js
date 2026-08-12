// Plan definitions. Max limits use Infinity internally so "unlimited" is easy;
// the API layer serializes it as the string "unlimited".
export const PLANS = {
  FREE: {
    label: "Free",
    monthlyPriceEGP: 0,
    maxQrs: 3,
    customDomains: false,
    features: ["Up to 3 QR codes", "Scan analytics"],
  },
  PRO: {
    label: "Pro",
    monthlyPriceEGP: 250,
    maxQrs: 50,
    customDomains: true,
    features: ["Up to 50 QR codes", "Scan analytics", "Custom domains"],
  },
  ENTERPRISE: {
    label: "Enterprise",
    monthlyPriceEGP: 1000,
    maxQrs: Infinity,
    customDomains: true,
    features: ["Unlimited QR codes", "Scan analytics", "Custom domains"],
  },
};

export const DEFAULT_PLAN = "FREE";

// Unknown plan types fall back to FREE so the app never breaks on bad data.
export function getPlan(planType) {
  return PLANS[planType] || PLANS[DEFAULT_PLAN];
}

export function getPlanSummary(planType) {
  const plan = getPlan(planType);
  return {
    ...plan,
    maxQrs: plan.maxQrs === Infinity ? "unlimited" : plan.maxQrs,
  };
}