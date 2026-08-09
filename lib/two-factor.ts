import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function isTwoFactorConfigured() {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.TOTP_ENCRYPTION_KEY?.trim());
}

function toBase32(bytes: Uint8Array) {
  let value = 0;
  let bits = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function fromBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("The authenticator secret is invalid.");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function keyMaterial() {
  const supplied = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!supplied) {
    if (process.env.NODE_ENV !== "production") return createHash("sha256").update("contractorcopilot-local-totp-only").digest();
    throw new Error("Two-factor authentication is not configured yet.");
  }
  if (/^[a-f0-9]{64}$/i.test(supplied)) return Buffer.from(supplied, "hex");
  const base64 = Buffer.from(supplied, "base64url");
  if (base64.length === 32) return base64;
  return createHash("sha256").update(supplied).digest();
}

export function generateTotpSecret() {
  return toBase32(randomBytes(20));
}

export function createOtpAuthUrl(email: string, secret: string) {
  const issuer = "ContractorCopilot";
  const label = `${issuer}:${email}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD_SECONDS) });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(ciphertext: string) {
  const [version, ivValue, tagValue, dataValue, ...extra] = ciphertext.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !dataValue || extra.length) throw new Error("The authenticator configuration is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", keyMaterial(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataValue, "base64url")), decipher.final()]).toString("utf8");
}

export function totpCounter(now = Date.now()) {
  return Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
}

export function createTotpCode(secret: string, counter = totpCounter()) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  counterBuffer.writeUInt32BE(counter >>> 0, 4);
  const digest = createHmac("sha1", fromBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(value % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

/** Returns a matching counter in a narrow one-period clock-skew window. */
export function matchTotpCode(secret: string, supplied: string, now = Date.now()) {
  const code = supplied.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpCounter(now);
  for (const candidate of [current, current - 1, current + 1]) {
    const expected = Buffer.from(createTotpCode(secret, candidate));
    const received = Buffer.from(code);
    if (expected.length === received.length && timingSafeEqual(expected, received)) return candidate;
  }
  return null;
}

function randomRecoveryValue(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = randomRecoveryValue();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(`contractorcopilot-recovery:${normalizeRecoveryCode(code)}`).digest("base64url");
}
