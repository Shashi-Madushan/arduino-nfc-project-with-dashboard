/**
 * GET    /api/students          — list all students
 * POST   /api/students          — create student
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Student from "@/lib/models/Student";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const students = await Student.find({}).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ students });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.studentId || !body?.name) {
    return NextResponse.json({ error: "studentId and name are required" }, { status: 400 });
  }

  await connectDB();

  const exists = await Student.findOne({ studentId: body.studentId });
  if (exists) {
    return NextResponse.json({ error: "Student ID already exists" }, { status: 409 });
  }

  const student = await Student.create({
    studentId: String(body.studentId).trim(),
    name:      String(body.name).trim(),
    email:     body.email ?? "",
    course:    body.course ?? "",
  });

  return NextResponse.json({ student }, { status: 201 });
}
