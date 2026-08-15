import { prisma } from "../prisma.js";
import { PLANS, getPlan, getPlanSummary } from "../config/plans.js";
import {
  getPaymentMethod,
  listPaymentMethods,
} from "../config/payments.js";
import {
  generatePaymentReference,
  isPlausibleReference,
  buildPayQrText,
} from "../utils/payment.js";

export async function getUserPlanType(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planType: true },
  });
  return user?.planType || "FREE";
}

export async function getPlanState(userId) {
  const planType = await getUserPlanType(userId);
  return {
    current: { planType, ...getPlanSummary(planType) },
    plans: Object.entries(PLANS).map(([planType, plan]) => ({
      planType,
      ...plan,
      maxQrs: plan.maxQrs === Infinity ? "unlimited" : plan.maxQrs,
    })),
    methods: listPaymentMethods(),
  };
}

// Creates a PENDING payment for the given plan and method and returns
// everything the frontend needs to show the pay instructions.
export async function createPayment(userId, planType, methodId) {
  if (!PLANS[planType] || planType === "FREE") {
    const err = new Error("Choose a paid plan to upgrade to");
    err.status = 400;
    throw err;
  }

  const method = getPaymentMethod(methodId);
  if (!method) {
    const err = new Error("Choose a payment method");
    err.status = 400;
    throw err;
  }

  const current = await getUserPlanType(userId);
  if (current === planType) {
    const err = new Error(`You are already on the ${getPlan(planType).label} plan`);
    err.status = 400;
    throw err;
  }

  const reference = generatePaymentReference();
  const plan = getPlan(planType);

  const payment = await prisma.payment.create({
    data: {
      userId,
      planType,
      amountEGP: plan.monthlyPriceEGP,
      reference,
      method: method.id,
    },
  });

  return {
    paymentId: payment.id,
    reference: payment.reference,
    amountEGP: payment.amountEGP,
    planType: payment.planType,
    planLabel: plan.label,
    method: method.id,
    account: method.account,
    payText: buildPayQrText({
      method,
      amountEGP: payment.amountEGP,
      reference: payment.reference,
    }),
  };
}

// Marks a payment as PAID and upgrades the user's plan. MVP self-served flow:
// the user proves payment by entering the transaction reference shown in their
// wallet app. (A real shop would reconcile with the provider first.)
export async function confirmPayment(userId, paymentId, externalRef) {
  if (!isPlausibleReference(externalRef)) {
    const err = new Error("Enter the reference you see in your payment app");
    err.status = 400;
    throw err;
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) {
    const err = new Error("Payment not found");
    err.status = 404;
    throw err;
  }

  const unpaid = ["PENDING"].includes(payment.status);
  if (!unpaid) {
    const err = new Error("This payment was already confirmed");
    err.status = 400;
    throw err;
  }

  await Promise.all([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", externalRef, paidAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { planType: payment.planType },
    }),
  ]);

  return {
    planType: payment.planType,
    plan: getPlanSummary(payment.planType),
  };
}