/**
 * GET    /api/devices  — list all registered devices
 * POST   /api/devices  — register a new device (generates token)
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Device from "@/lib/models/Device";
import { getSession } from "@/lib/auth";

/** Generate a 64-char hex token using the Web Crypto API (works in all runtimes) */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  // Never expose the raw token in list responses
  const devices = await Device.find({})
    .sort({ createdAt: -1 })
    .select("-token")
    .lean();
  return NextResponse.json({ devices });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name) {
    return NextResponse.json({ error: "Device name is required" }, { status: 400 });
  }

  const token = generateToken(); // 64-char hex

  await connectDB();
  const device = await Device.create({
    name:        String(body.name).trim(),
    description: body.description ? String(body.description).trim() : "",
    token,
  });

  // Return the token ONCE on creation — it won't be retrievable again
  return NextResponse.json(
    { device: { ...device.toObject(), token } },
    { status: 201 }
  );
}
