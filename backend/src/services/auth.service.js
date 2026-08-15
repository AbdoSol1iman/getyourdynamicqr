import bcrypt from "bcrypt";
import { prisma } from "../prisma.js";
import { signToken } from "../utils/jwt.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export async function registerUser(email, password) {
  if (!validateEmail(email)) {
    const err = new Error("Invalid email format");
    err.status = 400;
    throw err;
  }

  if (!validatePassword(password)) {
    const err = new Error("Password must be at least 8 characters");
    err.status = 400;
    throw err;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  return { id: user.id, email: user.email, planType: user.planType, role: user.role };
}

export async function loginUser(email, password) {
  if (!validateEmail(email) || !validatePassword(password)) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }

  const token = signToken(user.id);

  return {
    token,
    user: { id: user.id, email: user.email, planType: user.planType, role: user.role },
  };
}
