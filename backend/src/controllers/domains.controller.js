import {
  listDomains,
  createDomain,
  deleteDomain,
} from "../services/domains.service.js";

export async function list(req, res) {
  const domains = await listDomains(req.user.userId);
  res.json({ success: true, data: domains });
}

export async function create(req, res) {
  const { domain } = req.body;
  const created = await createDomain(req.user.userId, domain);
  res.status(201).json({ success: true, data: created });
}

export async function remove(req, res) {
  await deleteDomain(req.user.userId, req.params.id);
  res.json({ success: true, data: null });
}