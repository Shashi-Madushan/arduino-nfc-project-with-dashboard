/**
 * Device token validation — Node.js runtime only.
 * DO NOT import this file from middleware.ts (Edge runtime).
 */
import { connectDB } from "@/lib/db";
import Device, { IDevice } from "@/lib/models/Device";

export async function validateDeviceToken(
  authHeader: string | null
): Promise<IDevice | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  await connectDB();
  const device = await Device.findOne({ token });
  return device ?? null;
}
