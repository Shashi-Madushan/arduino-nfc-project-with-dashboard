import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Setting from "@/lib/models/Setting";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const setting = (await Setting.findOne().lean()) ?? { orderCutoff: "10:00" };
  return NextResponse.json({ setting });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.orderCutoff) return NextResponse.json({ error: "orderCutoff required" }, { status: 400 });

  await connectDB();
  const updated = await Setting.findOneAndUpdate({}, { orderCutoff: String(body.orderCutoff) }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return NextResponse.json({ setting: updated });
}
