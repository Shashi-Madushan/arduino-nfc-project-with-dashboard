"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cpu } from "lucide-react";

interface Device {
  _id: string;
  name: string;
  description: string;
  lastSeen: string | null;
  createdAt: string;
}

export default function DevicesPage() {
  const [devices, setDevices]   = useState<Device[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName]           = useState("");
  const [desc, setDesc]           = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);

  // Shown only once after creation
  const [newToken, setNewToken]   = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied]       = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/devices");
    const data = await res.json();
    setDevices(data.devices ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    setError("");
    if (!name.trim()) { setError("Device name is required"); return; }
    setSaving(true);
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: desc.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setShowModal(false);
      setName(""); setDesc("");
      setNewToken({ name: data.device.name, token: data.device.token });
      load();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to create device");
    }
  }

  async function handleDelete(device: Device) {
    if (!confirm(`Revoke access for "${device.name}"? The device will no longer be able to submit orders.`)) return;
    await fetch(`/api/devices/${device._id}`, { method: "DELETE" });
    load();
  }

  async function copyToken(token: string) {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  }
  function formatRelative(iso: string | null) {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Devices</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Each device gets its own token. Paste it into the Arduino config UI.
          </p>
        </div>
        <button
          onClick={() => { setShowModal(true); setError(""); setName(""); setDesc(""); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm
                     font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Device
        </button>
      </div>

      {/* One-time token reveal banner */}
      {newToken && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-1.5">
                <CheckCircle2 size={16} /> Device &ldquo;{newToken.name}&rdquo; created
              </p>
              <p className="text-xs text-green-700 mb-3">
                Copy this token now — it will <strong>not be shown again</strong>.
                Paste it into the Arduino&rsquo;s config UI under <em>JWT Token</em>.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-green-200 rounded-lg
                                 px-3 py-2 text-xs font-mono break-all text-slate-700">
                  {newToken.token}
                </code>
                <button
                  onClick={() => copyToken(newToken.token)}
                  className="shrink-0 px-3 py-2 bg-green-600 text-white text-xs font-medium
                             rounded-lg hover:bg-green-700 transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="text-green-500 hover:text-green-700 text-lg leading-none mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Device list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : devices.length === 0 ? (
          <div className="py-16 text-center">
            <div className="flex justify-center mb-3 text-slate-300">
              <Cpu size={48} />
            </div>
            <p className="text-sm text-slate-500 font-medium">No devices registered yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a device to generate a token for your Arduino.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Device</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Last Seen</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {devices.map((d) => (
                  <tr key={d._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-7 h-7
                                        bg-blue-100 text-blue-600 rounded-lg">
                          <Cpu size={14} />
                        </span>
                        <span className="font-medium text-slate-900">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{d.description || "—"}</td>
                    <td className="px-4 py-3">
                      {d.lastSeen ? (
                        <span className="inline-flex items-center gap-1 text-green-700
                                         bg-green-50 px-2 py-0.5 rounded-full text-xs">
                          <span className="w-2 h-2 rounded-full bg-green-500" /> {formatRelative(d.lastSeen)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs tabular-nums">
                      {formatDate(d.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(d)}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs text-blue-700">
          <strong>How it works:</strong> When you add a device, a random 64-character token is
          generated and stored in MongoDB. Copy it and paste into the Arduino config UI
          (<em>JWT Token</em> field). The device sends it as an{" "}
          <code className="bg-blue-100 px-1 rounded">Authorization: Bearer …</code> header on
          every card scan. Revoking a device immediately prevents it from logging orders.
        </p>
      </div>

      {/* Add device modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-1">Add Device</h2>
            <p className="text-xs text-slate-500 mb-4">
              A unique token will be generated. You&rsquo;ll see it once after saving.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Device Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Main Entrance Reader"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional note"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-sm
                           font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm
                           font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create Device"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
