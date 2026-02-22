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
import AttendanceLog from "@/lib/models/AttendanceLog";
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

  const log = await AttendanceLog.create({
    employeeId:   employee.employeeId,
    employeeName: employee.name,
    department:   employee.department ?? "",
    timestamp:    new Date(),
    deviceIp:     ip,
    status:       "present",
  });

  return NextResponse.json(
    { message: "Attendance recorded", logId: log._id },
    { status: 201 }
  );
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

  if (dateStr) {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);
    filter.timestamp = { $gte: start, $lte: end };
  }

  await connectDB();
  const [logs, total] = await Promise.all([
    AttendanceLog.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AttendanceLog.countDocuments(filter),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
