import { listUsers, updateUser } from "../services/admin.service.js";

// Owner-only: all users for the management dashboard.
export async function users(req, res) {
  const list = await listUsers();
  res.json({ success: true, data: list });
}

// Owner-only: update one user's plan / role / active flag.
export async function updateUserStatus(req, res) {
  const { id } = req.params;
  const updated = await updateUser(req.user.userId, id, req.body);
  res.json({ success: true, data: updated });
}