/**
 * POST /api/attendance
 *   Body: { "employeeId": "EMP001" }
 *   Header: Authorization: Bearer <DEVICE_JWT_SECRET>
 *   Returns 201 on success, 404 if employee not found, 401 if bad token
 *
 * GET /api/attendance
 *   Query: page, limit, date (YYYY-MM-DD), employeeId
 *   Protected: session cookie required
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { validateDeviceToken } from "@/lib/device-auth";
import { getSession } from "@/lib/auth";
import Employee from "@/lib/models/Employee";
import Order from "@/lib/models/Order";
import Setting from "@/lib/models/Setting";
import { headers } from "next/headers";

// ── POST — called by the Arduino device ──────────────────────────────────────
export async function POST(req: Request) {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const device = await validateDeviceToken(authHeader);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.employeeId) {
    return NextResponse.json({ error: "employeeId required" }, { status: 400 });
  }

  const employeeId: string = String(body.employeeId).trim();

  // connectDB already called inside validateDeviceToken, safe to reuse
  const employee = await Employee.findOne({ employeeId });

  // Update device lastSeen in background (don't await)
  device.updateOne({ lastSeen: new Date() }).exec();

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";

  // Get or fallback to default cutoff
  await connectDB();
  const setting = (await Setting.findOne().lean()) ?? { orderCutoff: "10:00" };

  // compute today's date and cutoff time
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStr = today.toISOString().slice(0, 10);

  const [cutHour, cutMin] = setting.orderCutoff.split(":").map((s: string) => parseInt(s, 10));
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate(), cutHour || 10, cutMin || 0, 0);

  let order;
  if (now <= cutoff) {
    // Before cutoff: mark as ordered (idempotent)
    order = await Order.findOneAndUpdate(
      { employeeId: employee.employeeId, date: dateStr },
      {
        $setOnInsert: {
          employeeName: employee.name,
          department: employee.department ?? "",
          date: dateStr,
        },
        $set: { deviceIp: ip },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Ensure orderedAt and status
    if (!order.orderedAt) {
      order.orderedAt = new Date();
      order.status = "ordered";
      await order.save();
    }

    return NextResponse.json({ message: "Order recorded", status: "ordered", orderId: order._id }, { status: 201 });
  } else {
    // After cutoff: treat as collection (taken). Find existing order or create taken record.
    order = await Order.findOneAndUpdate(
      { employeeId: employee.employeeId, date: dateStr },
      {
        $set: { takenAt: new Date(), status: "taken", deviceIp: ip },
        $setOnInsert: {
          employeeName: employee.name,
          department: employee.department ?? "",
          date: dateStr,
          orderedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ message: "Meal collected", status: "taken", orderId: order._id }, { status: 200 });
  }
}

// ── GET — dashboard queries ───────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page       = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit      = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const dateStr    = searchParams.get("date");
  const employeeId = searchParams.get("employeeId");

  const filter: Record<string, unknown> = {};
  if (employeeId) filter.employeeId = employeeId;
  if (dateStr) filter.date = dateStr;

  await connectDB();
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ date: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return NextResponse.json({ logs: orders, total, page, limit });
}
