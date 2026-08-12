import { registerUser, loginUser } from "../services/auth.service.js";

export async function register(req, res) {
  const { email, password } = req.body;
  const user = await registerUser(email, password);
  res.status(201).json({ success: true, data: user });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  res.json({ success: true, data: result });
}
