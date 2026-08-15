// Plan definitions. Max limits use Infinity internally so "unlimited" is easy;
// the API layer serializes it as the string "unlimited".
// monthlyPriceEGP is what customers actually pay (Egypt wallet billing);
// monthlyPriceUSD is the strategic list price used for US/EU positioning and
// annual-billing math. popular marks the "Most Popular" upsell plan.
export const PLANS = {
  FREE: {
    label: "Free",
    key: "FREE",
    monthlyPriceEGP: 0,
    monthlyPriceUSD: 0,
    maxQrs: 3,
    customDomains: false,
    popular: false,
    features: [
      "Up to 3 dynamic QR codes",
      "Unlimited scans",
      "Basic scan count",
      "Basic device analytics",
      "Editable destination URLs",
      "Basic QR customization",
      "Branded short URL",
    ],
  },
  STARTER: {
    label: "Starter",
    key: "STARTER",
    monthlyPriceEGP: 250,
    monthlyPriceUSD: 5,
    maxQrs: 10,
    customDomains: false,
    popular: false,
    features: [
      "Up to 10 dynamic QR codes",
      "Unlimited scans",
      "Scan analytics",
      "Device analytics",
      "Country analytics",
      "QR customization",
      "Unlimited destination URL edits",
      "QR activation / deactivation",
      "PNG / SVG QR downloads",
    ],
  },
  PRO: {
    label: "Pro",
    key: "PRO",
    monthlyPriceEGP: 500,
    monthlyPriceUSD: 12,
    maxQrs: 50,
    customDomains: true,
    popular: true,
    features: [
      "Up to 50 dynamic QR codes",
      "Unlimited scans",
      "Advanced analytics",
      "Country and city analytics",
      "Device, OS, and browser analytics",
      "Scan history",
      "Advanced QR customization",
      "Custom short codes",
      "Custom domains",
      "Remove Dynamic QR branding",
      "Multiple QR campaigns",
      "Analytics export",
      "Priority support",
    ],
  },
  BUSINESS: {
    label: "Business",
    key: "BUSINESS",
    monthlyPriceEGP: 1200,
    monthlyPriceUSD: 29,
    maxQrs: 250,
    customDomains: true,
    popular: false,
    features: [
      "Up to 250 dynamic QR codes",
      "Everything in Pro",
      "5 team members",
      "Role-based permissions",
      "Multiple custom domains",
      "Bulk QR generation",
      "Bulk QR management",
      "Advanced analytics",
      "CSV export",
      "API access",
      "Webhooks",
      "Priority support",
    ],
  },
  AGENCY: {
    label: "Agency",
    key: "AGENCY",
    monthlyPriceEGP: 3000,
    monthlyPriceUSD: 79,
    maxQrs: Infinity,
    customDomains: true,
    popular: false,
    features: [
      "Unlimited dynamic QR codes",
      "10+ team members",
      "Unlimited clients / projects",
      "White-label experience",
      "Multiple custom domains",
      "Bulk QR generation",
      "Bulk QR management",
      "API access",
      "Client analytics",
      "Client workspaces",
      "Priority support",
    ],
  },
};

// ENTERPRISE is kept as a compatibility alias for accounts created before the
// pricing refresh (tests + any live rows). It behaves like AGENCY.
PLANS.ENTERPRISE = { ...PLANS.AGENCY, label: "Enterprise", key: "ENTERPRISE" };

export const DEFAULT_PLAN = "FREE";

// The order plans are shown in the catalogue (price ladder).
export const PLAN_ORDER = ["FREE", "STARTER", "PRO", "BUSINESS", "AGENCY"];

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