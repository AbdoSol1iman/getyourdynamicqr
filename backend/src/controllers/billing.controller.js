import {
  getPlanState,
  createPayment,
  confirmPayment,
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

export async function confirm(req, res) {
  const { paymentId, externalRef } = req.body;
  const result = await confirmPayment(req.user.userId, paymentId, externalRef);
  res.json({ success: true, data: result });
}