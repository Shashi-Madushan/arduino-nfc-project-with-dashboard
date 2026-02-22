import { connectDB } from "@/lib/db";
import AttendanceLog from "@/lib/models/AttendanceLog";
import Employee from "@/lib/models/Employee";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

interface LogEntry {
  _id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  timestamp: string;
}

interface Stats {
  totalEmployees: number;
  presentToday: number;
  todayScans: number;
  absentToday: number;
}

async function getData(): Promise<{ stats: Stats; recentLogs: LogEntry[] }> {
  await connectDB();

  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  const filter = { timestamp: { $gte: start, $lte: end } };

  const [totalEmployees, todayLogs, uniqueToday, recent] = await Promise.all([
    Employee.countDocuments(),
    AttendanceLog.countDocuments(filter),
    AttendanceLog.distinct("employeeId", filter),
    AttendanceLog.find(filter).sort({ timestamp: -1 }).limit(10).lean(),
  ]);

  return {
    stats: {
      totalEmployees,
      presentToday: uniqueToday.length,
      todayScans: todayLogs,
      absentToday: Math.max(0, totalEmployees - uniqueToday.length),
    },
    recentLogs: recent.map((l) => ({
      _id:          String(l._id),
      employeeId:   l.employeeId,
      employeeName: l.employeeName,
      department:   l.department,
      timestamp:    l.timestamp.toISOString(),
    })),
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { stats, recentLogs } = await getData();
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const statCards = [
    { label: "Total Employees",  value: stats.totalEmployees,  color: "bg-blue-50 text-blue-700",   icon: "👥" },
    { label: "Present Today",    value: stats.presentToday,    color: "bg-green-50 text-green-700",  icon: "✅" },
    { label: "Absent Today",     value: stats.absentToday,     color: "bg-red-50 text-red-700",      icon: "❌" },
    { label: "Total Scans Today",value: stats.todayScans,      color: "bg-purple-50 text-purple-700",icon: "📡" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl ${color} mb-3`}>
              {icon}
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Attendance rate bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Today&apos;s Attendance Rate</h2>
          <span className="text-sm font-bold text-slate-700">
            {stats.totalEmployees > 0
              ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
              : 0}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{
              width: stats.totalEmployees > 0
                ? `${(stats.presentToday / stats.totalEmployees) * 100}%`
                : "0%",
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-1.5">
          <span>{stats.presentToday} present</span>
          <span>{stats.absentToday} absent</span>
        </div>
      </div>

      {/* Recent scans */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Recent Scans Today</h2>
          <a href="/attendance" className="text-sm text-blue-600 hover:underline">View all</a>
        </div>
        {recentLogs.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-400">
            No scans recorded yet today
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentLogs.map((log) => (
              <div key={log._id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{log.employeeName}</p>
                  <p className="text-xs text-slate-400">
                    {log.employeeId}
                    {log.department ? ` · ${log.department}` : ""}
                  </p>
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {new Date(log.timestamp).toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
