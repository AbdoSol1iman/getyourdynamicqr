import {
  getPlanState,
  createPayment,
  submitPaymentForReview,
  resubmitDeclinedPayment,
  approvePayment,
  declinePayment,
  listPayments,
} from "../services/billing.service.js";

export async function plan(req, res) {
  const state = await getPlanState(req.user.userId);
  res.json({ success: true, data: state });
}

export async function pay(req, res) {
  const { planType, method } = req.body;
  const payment = await createPayment(req.user.userId, planType, method);
  res.status(201).json({ success: true, data: payment });
}

// User has transferred the money and submits their transaction reference for
// manual review. The plan is NOT upgraded here.
export async function submit(req, res) {
  const { paymentId, externalRef } = req.body;
  const result = await submitPaymentForReview(req.user.userId, paymentId, externalRef);
  res.json({ success: true, data: result });
}

// User fixes a declined payment (re-sends transfer, new reference).
export async function resubmit(req, res) {
  const { paymentId, externalRef } = req.body;
  const result = await resubmitDeclinedPayment(req.user.userId, paymentId, externalRef);
  res.json({ success: true, data: result });
}

// Owner-only: list payments (optionally by status).
export async function payments(req, res) {
  const { status } = req.query;
  const list = await listPayments(status);
  res.json({ success: true, data: list });
}

// Owner-only: approve a submitted payment and upgrade the user's plan.
export async function approve(req, res) {
  const { paymentId } = req.params;
  const result = await approvePayment(paymentId);
  res.json({ success: true, data: result });
}

// Owner-only: decline a submitted payment (transfer never arrived, bad ref…).
export async function decline(req, res) {
  const { paymentId } = req.params;
  const { reason } = req.body;
  const result = await declinePayment(paymentId, reason);
  res.json({ success: true, data: result });
}