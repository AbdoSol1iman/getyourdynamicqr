import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LENGTH = 6;

export function generateShortCode() {
  const bytes = crypto.randomBytes(LENGTH);
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
