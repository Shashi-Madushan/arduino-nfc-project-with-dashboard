"use client";

import { useState } from "react";

export default function SettingsPage() {
  const deviceSecret = process.env.NEXT_PUBLIC_DEVICE_JWT_HINT ?? "(set DEVICE_JWT_SECRET in .env.local)";
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Device configuration and system info</p>
      </div>

      {/* Device setup card */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-4">
        <div className="px-5 py-4">
          <h2 className="font-semibold text-slate-800 mb-1">Arduino Device Setup</h2>
          <p className="text-xs text-slate-500">
            Open <code className="bg-slate-100 px-1 py-0.5 rounded">192.168.4.1</code> when the device is
            in AP mode (hotspot: <code className="bg-slate-100 px-1 py-0.5 rounded">NFC-Attendance-Config</code>)
            and paste the values below into the config form.
          </p>
        </div>

        {/* Endpoint */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Endpoint URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm break-all">
              {typeof window !== "undefined" ? `${window.location.origin}/api/attendance` : "https://your-app.vercel.app/api/attendance"}
            </code>
            <button
              onClick={() => copy(
                typeof window !== "undefined" ? `${window.location.origin}/api/attendance` : "",
                "endpoint"
              )}
              className="shrink-0 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              {copied === "endpoint" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* JWT Token */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-1">Device JWT Token</p>
          <p className="text-xs text-slate-400 mb-2">
            This must match the <code>DEVICE_JWT_SECRET</code> value in your <code>.env.local</code> file.
            Paste it into the <strong>JWT Token</strong> field in the device config UI.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono truncate">
              {deviceSecret}
            </code>
            <button
              onClick={() => copy(deviceSecret, "jwt")}
              className="shrink-0 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
            >
              {copied === "jwt" ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 mt-2 px-3 py-2 rounded-lg">
            ⚠️ To show the actual token here, add{" "}
            <code>NEXT_PUBLIC_DEVICE_JWT_HINT=your-token</code> to{" "}
            <code>.env.local</code>. Keep it secret in production.
          </p>
        </div>
      </div>

      {/* Quick guide */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4">
        <h2 className="font-semibold text-slate-800 mb-3">Quick Setup Guide</h2>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>Flash <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">EspNfcReader.ino</code> to the ESP8266 D1 Mini.</li>
          <li>On first boot it creates a hotspot: <strong>NFC-Attendance-Config</strong> (password: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">admin1234</code>).</li>
          <li>Connect to the hotspot and open <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">192.168.4.1</code> in a browser.</li>
          <li>Paste the <strong>Endpoint URL</strong> and <strong>JWT Token</strong> from above into the form. Fill in your WiFi credentials.</li>
          <li>Save &amp; the device restarts in <strong>Reader mode</strong>.</li>
          <li>Add employees on the <a href="/employees" className="text-blue-600 hover:underline">Employees</a> page first.</li>
          <li>To program a card: switch to <strong>Writer mode</strong> in the device settings → go to <code>192.168.x.x/write</code> → tap card.</li>
          <li>Switch back to <strong>Reader mode</strong> — tapping a programmed card logs attendance automatically.</li>
        </ol>
      </div>

      {/* NeoPixel legend */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <h2 className="font-semibold text-slate-800 mb-3">NeoPixel LED Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { led: "LED 0", desc: "WiFi", bullets: ["🔵 Blue = connected", "🟢 Blinking green = connecting", "🔴 Red = failed"] },
            { led: "LED 1", desc: "Mode / Status", bullets: ["🔵 Blue = reader ready", "🟣 Purple = writer ready", "🔴 Red = HTTP error"] },
            { led: "LED 2+3", desc: "Operation Result", bullets: ["🟢 Green = success (200/201)", "🟡 Yellow = unknown card (404)", "🔴 Red = error / idle"] },
          ].map(({ led, desc, bullets }) => (
            <div key={led} className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1">{led} — {desc}</p>
              <ul className="space-y-0.5 text-slate-600">
                {bullets.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
