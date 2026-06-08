import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { normalizeEngagementStatus } from "@/lib/engagement";
import { logIntegrationSync, updateClientEngagementByEmails } from "@/lib/repository";
import type { EngagementStatus } from "@/lib/types";

const allowedStatuses = new Set<EngagementStatus>([
  "active",
  "dormant",
  "inactive",
  "unknown",
]);

function signatureMatches(header: string | null, body: string, secret: string) {
  if (!header) return false;

  const received = header.trim().replace(/^sha256=/i, "");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function emailsForCustomer(customer: Record<string, unknown>) {
  const aliases = Array.isArray(customer.aliases) ? customer.aliases : [];
  return [customer.email, ...aliases]
    .map((email) => String(email ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizePayloadStatus(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();
  const status = normalizeEngagementStatus(value);
  if (!allowedStatuses.has(raw as EngagementStatus)) {
    throw new Error(`Unsupported engagement_status: ${value}`);
  }
  return status;
}

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 401 });
  }

  const body = await request.text();
  if (!signatureMatches(request.headers.get("X-Signature"), body, secret)) {
    return NextResponse.json({ error: "Invalid finance webhook signature" }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const customers = Array.isArray(payload.customers)
    ? payload.customers
    : [payload.customer ?? payload];
  let matched = 0;

  try {
    for (const item of customers) {
      const customer = item as Record<string, unknown>;
      const emails = emailsForCustomer(customer);
      if (!emails.length) continue;

      matched += await updateClientEngagementByEmails({
        emails,
        status: normalizePayloadStatus(customer.engagement_status),
        asOf: String(customer.as_of ?? payload.as_of ?? new Date().toISOString()),
      });
    }

    await logIntegrationSync({
      source: "finance-webhook",
      matched,
      received: customers.length,
    });
  } catch (error) {
    await logIntegrationSync({
      source: "finance-webhook",
      matched,
      received: customers.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Finance webhook update failed" },
      { status: 400 },
    );
  }

  return NextResponse.json({ matched, received: customers.length });
}
