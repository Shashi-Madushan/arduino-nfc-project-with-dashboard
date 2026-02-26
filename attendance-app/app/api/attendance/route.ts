/**
 * POST /api/attendance
 *   Body: { "studentId": "STU001" }
 *   Header: Authorization: Bearer <DEVICE_JWT_SECRET>
 *   Returns 201 on success, 404 if student not found, 401 if bad token
 *
 * GET /api/attendance
 *   Query: page, limit, date (YYYY-MM-DD), studentId
 *   Protected: session cookie required
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { validateDeviceToken } from "@/lib/device-auth";
import { getSession } from "@/lib/auth";
import Student from "@/lib/models/Student";
import AttendanceLog from "@/lib/models/AttendanceLog";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const device = await validateDeviceToken(authHeader);
  if (!device) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  // console.log(body)
  if (!body?.employeeId) {
    return NextResponse.json({ error: "studentId required" }, { status: 400 });
  }

  const studentId: string = String(body.employeeId).trim();
  const student = await Student.findOne({ studentId });

  device.updateOne({ lastSeen: new Date() }).exec();

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? "unknown";

  const log = await AttendanceLog.create({
    studentId:   student.studentId,
    studentName: student.name,
    course:      student.course ?? "",
    timestamp:   new Date(),
    deviceIp:    ip,
    status:      "present",
  });

  return NextResponse.json(
    { message: "Attendance recorded", logId: log._id },
    { status: 201 }
  );
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit     = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const dateStr   = searchParams.get("date");
  const studentId = searchParams.get("studentId");

  const filter: Record<string, unknown> = {};
  if (studentId) filter.studentId = studentId;

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
