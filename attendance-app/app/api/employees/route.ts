/**
 * GET    /api/employees          — list all employees
 * POST   /api/employees          — create employee
 */
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Employee from "@/lib/models/Employee";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const employees = await Employee.find({}).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ employees });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.employeeId || !body?.name) {
    return NextResponse.json({ error: "employeeId and name are required" }, { status: 400 });
  }

  await connectDB();

  const exists = await Employee.findOne({ employeeId: body.employeeId });
  if (exists) {
    return NextResponse.json({ error: "Employee ID already exists" }, { status: 409 });
  }

  const employee = await Employee.create({
    employeeId: String(body.employeeId).trim(),
    name:       String(body.name).trim(),
    email:      body.email ?? "",
    department: body.department ?? "",
  });

  return NextResponse.json({ employee }, { status: 201 });
}
