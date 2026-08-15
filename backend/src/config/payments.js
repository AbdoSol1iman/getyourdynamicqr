// Payment methods customers can pay for plan upgrades with.
// These are manual wallet transfers (self-served MVP confirmation).
export const PAYMENT_METHODS = {
  WEPAY: {
    id: "WEPAY",
    label: "WePay",
    account: process.env.WEPAY_ACCOUNT || "01557886491",
    kind: "mobile-number",
  },
  TELDA: {
    id: "TELDA",
    label: "Telda",
    account: process.env.TELDA_ACCOUNT || "@abdo2388",
    kind: "username",
  },
};

export function getPaymentMethod(id) {
  return PAYMENT_METHODS[id] || null;
}

export function listPaymentMethods() {
  return Object.values(PAYMENT_METHODS);
}