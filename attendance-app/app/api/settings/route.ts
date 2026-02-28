import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Setting from "@/lib/models/Setting";
import { getSession } from "@/lib/auth";

function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

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
  if (!body?.orderCutoff) {
    return NextResponse.json({ error: "orderCutoff field is required" }, { status: 400 });
  }

  const orderCutoff = String(body.orderCutoff).trim();
  
  if (!validateTimeFormat(orderCutoff)) {
    return NextResponse.json({ 
      error: "Invalid time format. Use HH:MM format (e.g., 09:30)" 
    }, { status: 400 });
  }

  try {
    await connectDB();
    const updated = await Setting.findOneAndUpdate(
      { }, 
      { 
        orderCutoff,
        updatedAt: new Date()
      }, 
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return NextResponse.json({ 
      success: true,
      message: `Cutoff time updated to ${orderCutoff}`,
      setting: updated 
    });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json({ 
      error: "Failed to update settings. Please try again." 
    }, { status: 500 });
  }
}
