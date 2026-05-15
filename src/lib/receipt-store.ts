/**
 * Receipt store — read/write JSON receipts to Azure Blob.
 *
 * Container: AZURE_STORAGE_CONTAINER_RECEIPTS (= "a2a-receipts")
 * Blob path: <receipt-id>.json
 * Blobs are public-read so receipt URLs work without auth.
 */

import {
  BlobServiceClient,
  type ContainerClient,
} from "@azure/storage-blob";

let cachedContainer: ContainerClient | null = null;

function getContainer(): ContainerClient {
  if (cachedContainer) return cachedContainer;
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING_RECEIPTS;
  if (!connStr) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING_RECEIPTS not set");
  }
  const containerName =
    process.env.AZURE_STORAGE_CONTAINER_RECEIPTS ?? "a2a-receipts";
  const service = BlobServiceClient.fromConnectionString(connStr);
  cachedContainer = service.getContainerClient(containerName);
  return cachedContainer;
}

export async function saveReceipt(
  receiptId: string,
  receipt: unknown,
): Promise<void> {
  const container = getContainer();
  const blob = container.getBlockBlobClient(`${receiptId}.json`);
  const body = JSON.stringify(receipt, null, 2);
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: {
      blobContentType: "application/json; charset=utf-8",
      blobCacheControl: "public, max-age=60",
    },
  });
}

export async function loadReceipt<T = unknown>(
  receiptId: string,
): Promise<T | null> {
  const container = getContainer();
  const blob = container.getBlockBlobClient(`${receiptId}.json`);
  try {
    const buf = await blob.downloadToBuffer();
    return JSON.parse(buf.toString("utf-8")) as T;
  } catch (err: unknown) {
    const code = (err as { statusCode?: number; code?: string })?.statusCode;
    if (code === 404) return null;
    throw err;
  }
}

/** Generate a stable receipt id like rcpt_2026-05-15_a1b2c3d4. */
export function newReceiptId(now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = randomHex(8);
  return `rcpt_${yyyy}-${mm}-${dd}_${rand}`;
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, n);
}
