/**
 * JOSE HS256 download-token minting.
 *
 * Tokens are validated by estore.adotob.com's existing /api/download/[token]
 * route. The signing secret (DOWNLOAD_TOKEN_SECRET) is shared cross-app.
 *
 * Payload shape:   { scope: "trial", sessionId: <receipt-id> }
 * Expiry:          24 hours
 */

import { SignJWT } from "jose";

const TOKEN_EXPIRY = "24h";

function getSigningKey(): Uint8Array {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!secret) {
    throw new Error("DOWNLOAD_TOKEN_SECRET not set");
  }
  return new TextEncoder().encode(secret);
}

export async function mintDownloadToken(receiptId: string): Promise<string> {
  const key = getSigningKey();
  const token = await new SignJWT({
    scope: "trial",
    sessionId: receiptId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(key);
  return token;
}

export function buildDownloadUrl(token: string): string {
  const base = process.env.ESTORE_URL ?? "https://estore.adotob.com";
  return `${base.replace(/\/+$/, "")}/api/download/${token}`;
}
