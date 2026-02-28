import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Order from "@/lib/models/Order";
import Employee from "@/lib/models/Employee";
import { getSession } from "@/lib/auth";
import PDFDocument from "pdfkit";

function monthRange(monthStr?: string) {
  // monthStr format: YYYY-MM
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (monthStr) {
    const [y, m] = monthStr.split("-").map((s) => parseInt(s, 10));
    if (!isNaN(y) && !isNaN(m)) {
      year = y; month = m - 1;
    }
  }
  const start = new Date(year, month, 1, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end, label: `${year}-${String(month + 1).padStart(2, "0")}` };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? undefined; // YYYY-MM

  await connectDB();
  const { start, end, label } = monthRange(month);

  // Orders within month (date field is YYYY-MM-DD, but createdAt/timestamps exist)
  const orders = await Order.find({
    // match by createdAt between start and end
    createdAt: { $gte: start, $lte: end },
  }).lean();

  // Build per-employee summary
  const summaryMap: Record<string, { name: string; employeeId: string; orders: number; taken: number }> = {};
  for (const o of orders) {
    const id = o.employeeId;
    if (!summaryMap[id]) summaryMap[id] = { name: o.employeeName || "-", employeeId: id, orders: 0, taken: 0 };
    summaryMap[id].orders += o.orderedAt ? 1 : 0;
    summaryMap[id].taken += o.takenAt ? 1 : 0;
  }

  // Create PDF
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const title = `Canteen Report — ${label}`;
  doc.fontSize(16).text(title, { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  // table header
  doc.text("Employee", { continued: true, width: 200 });
  doc.text("ID", { continued: true, width: 100 });
  doc.text("Orders", { continued: true, width: 80 });
  doc.text("Taken", { width: 80 });
  doc.moveDown(0.5);

  Object.values(summaryMap).forEach((row) => {
    doc.text(row.name, { continued: true, width: 200 });
    doc.text(row.employeeId, { continued: true, width: 100 });
    doc.text(String(row.orders), { continued: true, width: 80 });
    doc.text(String(row.taken), { width: 80 });
  });

  // totals
  const totals = Object.values(summaryMap).reduce((acc, r) => ({ orders: acc.orders + r.orders, taken: acc.taken + r.taken }), { orders: 0, taken: 0 });
  doc.moveDown();
  doc.text(`Total Orders: ${totals.orders} — Total Taken: ${totals.taken}`);

  doc.end();

  const pdf: Buffer = await new Promise((resolve, reject) => {
    const bufs: Buffer[] = [];
    doc.on("data", (c) => bufs.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(bufs)));
    doc.on("error", (err) => reject(err));
  });

  const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  return new NextResponse(pdfArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="canteen-report-${label}.pdf"`,
    },
  });
}
