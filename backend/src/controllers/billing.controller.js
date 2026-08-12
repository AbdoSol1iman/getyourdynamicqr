import {
  getPlanState,
  createInstapayPayment,
  confirmInstapayPayment,
} from "../services/billing.service.js";

export async function plan(req, res) {
  const state = await getPlanState(req.user.userId);
  res.json({ success: true, data: state });
}

export async function instapay(req, res) {
  const { planType } = req.body;
  const payment = await createInstapayPayment(req.user.userId, planType);
  res.status(201).json({ success: true, data: payment });
}

export async function confirm(req, res) {
  const { paymentId, instapayRef } = req.body;
  const result = await confirmInstapayPayment(req.user.userId, paymentId, instapayRef);
  res.json({ success: true, data: result });
}