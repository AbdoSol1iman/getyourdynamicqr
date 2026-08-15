import QRCode from "qrcode";
import { prisma } from "../prisma.js";
import { PLANS, PLAN_ORDER, getPlan, getPlanSummary } from "../config/plans.js";
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
  const [planType, declined] = await Promise.all([
    getUserPlanType(userId),
    prisma.payment.findFirst({
      where: { userId, status: "DECLINED" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    current: { planType, ...getPlanSummary(planType) },
    plans: PLAN_ORDER.map((key) => {
      const plan = PLANS[key];
      return {
        planType: key,
        ...plan,
        maxQrs: plan.maxQrs === Infinity ? "unlimited" : plan.maxQrs,
      };
    }),
    methods: listPaymentMethods(),
    declined: declined
      ? {
          paymentId: declined.id,
          planType: declined.planType,
          amountEGP: declined.amountEGP,
          reference: declined.reference,
          reason: declined.declineReason,
        }
      : null,
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

  const payText = buildPayQrText({
    method,
    amountEGP: payment.amountEGP,
    reference: payment.reference,
  });

  // The pay QR encodes the payment instructions (same pattern as dashboard
  // QRs, which ship a backend-generated image). Best-effort: if generation
  // fails we still return the payment so the text instructions work.
  const qrImage = await QRCode.toDataURL(payText).catch(() => null);
  const payImage =
    typeof qrImage === "string" && qrImage.startsWith("data:image/png;base64,")
      ? qrImage
      : null;

  return {
    paymentId: payment.id,
    reference: payment.reference,
    amountEGP: payment.amountEGP,
    planType: payment.planType,
    planLabel: plan.label,
    method: method.id,
    account: method.account,
    payText,
    qrImage: payImage,
  };
}

// Marks a payment as SUBMITTED after the user completes a transfer and enters
// the transaction reference from their wallet app. The plan is NOT upgraded
// here — a real human (the owner) verifies the money actually arrived and
// approves the payment before the plan changes.
export async function submitPaymentForReview(userId, paymentId, externalRef) {
  if (!isPlausibleReference(externalRef)) {
    const err = new Error("Enter the transaction reference you see in your payment app");
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

  if (payment.status !== "PENDING") {
    const err = new Error("This payment was already submitted");
    err.status = 400;
    throw err;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUBMITTED", externalRef },
  });

  return {
    status: "SUBMITTED",
    message:
      "Your payment request was submitted. We'll review it and activate your plan once the transfer is confirmed.",
  };
}

// Owner-only: after verifying the money arrived, mark the payment PAID and
// upgrade the user's plan.
export async function approvePayment(paymentId) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    const err = new Error("Payment not found");
    err.status = 404;
    throw err;
  }

  if (payment.status !== "SUBMITTED") {
    const err = new Error("Only submitted payments can be approved");
    err.status = 400;
    throw err;
  }

  await Promise.all([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.user.update({
      where: { id: payment.userId },
      data: { planType: payment.planType },
    }),
  ]);

  return {
    planType: payment.planType,
    plan: getPlanSummary(payment.planType),
  };
}

// Owner-only: reject a submitted payment (e.g. transfer never arrived or the
// reference does not match). The plan is NOT upgraded. A declined payment can
// be re-submitted by the customer after they fix the problem.
export async function declinePayment(paymentId, reason) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    const err = new Error("Payment not found");
    err.status = 404;
    throw err;
  }

  if (payment.status !== "SUBMITTED") {
    const err = new Error("Only submitted payments can be declined");
    err.status = 400;
    throw err;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "DECLINED", declineReason: reason || null },
  });

  return { status: "DECLINED" };
}

// User-side: re-submit a declined payment after the customer fixes the issue
// (e.g. they re-send the transfer and provide a new reference). Back to review,
// decline reason cleared.
export async function resubmitDeclinedPayment(userId, paymentId, externalRef) {
  if (!isPlausibleReference(externalRef)) {
    const err = new Error("Enter the transaction reference you see in your payment app");
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

  if (payment.status !== "DECLINED") {
    const err = new Error("Only declined payments can be re-submitted");
    err.status = 400;
    throw err;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "SUBMITTED", externalRef, declineReason: null },
  });

  return {
    status: "SUBMITTED",
    message:
      "Your payment was re-submitted. We'll review it again and activate your plan once the transfer is confirmed.",
  };
}

// Owner-only: list payments, optionally filtered by status.
export async function listPayments(status) {
  const where = status ? { status } : {};
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { email: true } } },
  });
  return payments.map((p) => ({
    id: p.id,
    email: p.user.email,
    planType: p.planType,
    amountEGP: p.amountEGP,
    reference: p.reference,
    method: p.method,
    externalRef: p.externalRef,
    status: p.status,
    declineReason: p.declineReason,
    createdAt: p.createdAt,
    paidAt: p.paidAt,
  }));
}