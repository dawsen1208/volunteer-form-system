import bcrypt from "bcryptjs";
import crypto from "crypto";

import { env } from "../config/env";

const SALT_ROUNDS = 10;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export async function verifyPassword(
  plainPassword: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

type EncryptedPassword = {
  cipherText: string;
  iv: string;
  tag: string;
};

function getPasswordEncryptionKey(): Buffer {
  const hash = crypto.createHash("sha256").update(env.JWT_SECRET).digest();
  return hash;
}

export function encryptPassword(plainPassword: string): EncryptedPassword {
  const key = getPasswordEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipherText = Buffer.concat([cipher.update(plainPassword, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipherText: cipherText.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64")
  };
}

export function decryptPassword(enc: EncryptedPassword): string {
  const key = getPasswordEncryptionKey();
  const iv = Buffer.from(enc.iv, "base64");
  const tag = Buffer.from(enc.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([
    decipher.update(Buffer.from(enc.cipherText, "base64")),
    decipher.final()
  ]);
  return plain.toString("utf8");
}
