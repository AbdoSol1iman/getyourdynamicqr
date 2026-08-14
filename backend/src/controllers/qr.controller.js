import {
  createQr,
  listQrs,
  getQr,
  updateQr,
  softDeleteQr,
  getQrAnalytics,
  verifyQrHealth,
} from "../services/qr.service.js";

export async function create(req, res) {
  const { title, destinationUrl, domainId } = req.body;
  const qr = await createQr({ userId: req.user.userId, title, destinationUrl, domainId });
  res.status(201).json({ success: true, data: qr });
}

export async function list(req, res) {
  const qrs = await listQrs(req.user.userId);
  res.json({ success: true, data: qrs });
}

export async function getOne(req, res) {
  const qr = await getQr(req.user.userId, req.params.id);
  res.json({ success: true, data: qr });
}

export async function update(req, res) {
  const qr = await updateQr(req.user.userId, req.params.id, req.body);
  res.json({ success: true, data: qr });
}

export async function remove(req, res) {
  await softDeleteQr(req.user.userId, req.params.id);
  res.status(200).json({ success: true, data: null });
}

export async function analytics(req, res) {
  const result = await getQrAnalytics(req.user.userId, req.params.id);
  res.json({ success: true, data: result });
}

export async function health(req, res) {
  const result = await verifyQrHealth(req.user.userId, req.params.id);
  res.json({ success: true, data: result });
}
