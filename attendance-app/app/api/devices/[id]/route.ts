/**
 * DELETE /api/devices/[id]  — remove a device (revokes its token)
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Device from "@/lib/models/Device";
import { getSession } from "@/lib/auth";

interface Params { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await connectDB();
  const device = await Device.findByIdAndDelete(id);
  if (!device) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
