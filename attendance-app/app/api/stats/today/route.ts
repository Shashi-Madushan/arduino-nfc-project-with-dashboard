/** GET /api/stats/today — summary counts for the dashboard */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import AttendanceLog from "@/lib/models/AttendanceLog";
import Student from "@/lib/models/Student";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);

  await connectDB();
  const [totalStudents, todayLogs, uniqueToday] = await Promise.all([
    Student.countDocuments(),
    AttendanceLog.countDocuments({ timestamp: { $gte: start, $lte: end } }),
    AttendanceLog.distinct("studentId", { timestamp: { $gte: start, $lte: end } }),
  ]);

  return NextResponse.json({
    totalStudents,
    presentToday:  uniqueToday.length,
    todayScans:    todayLogs,
    absentToday:   Math.max(0, totalStudents - uniqueToday.length),
  });
}
