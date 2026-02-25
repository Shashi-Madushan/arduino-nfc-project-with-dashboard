"use client";

import { useEffect, useState, useCallback } from "react";

interface Log {
  _id: string;
  studentId: string;
  studentName: string;
  course: string;
  timestamp: string;
  deviceIp: string;
  status: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [logs, setLogs]       = useState<Log[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const [date, setDate]       = useState(todayStr());
  const [empId, setEmpId]     = useState("");
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
    });
    if (date)  params.set("date", date);
    if (empId) params.set("studentId", empId.trim());

    const res  = await fetch(`/api/attendance?${params}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, date, empId]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 on filter change
  function applyFilter() { setPage(1); }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Attendance Logs</h1>
        <p className="text-sm text-slate-500 mt-0.5">{total} records matching current filter</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="text"
          placeholder="Student ID"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-40
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={applyFilter}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          Filter
        </button>
        <button
          onClick={() => { setDate(todayStr()); setEmpId(""); setPage(1); }}
          className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">No records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Course</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => {
                  const dt = new Date(log.timestamp);
                  return (
                    <tr key={log._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{log.studentName}</td>
                      <td className="px-4 py-3">
                        <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                          {log.studentId}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{log.course || "—"}</td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">
                        {dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-slate-500 tabular-nums">
                        {dt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium
                          ${log.status === "present"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                          }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg disabled:opacity-40 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
