"use client";

import { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/attendance`
      : "https://your-app.vercel.app/api/attendance";

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            Open <code className="bg-slate-100 px-1 py-0.5 rounded">192.168.4.1</code> when the
            device is in AP mode (hotspot:{" "}
            <code className="bg-slate-100 px-1 py-0.5 rounded">NFC-Attendance-Config</code>) and
            fill in the two values below.
          </p>
        </div>

        {/* Endpoint */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-1">
            1 · Endpoint URL <span className="text-slate-400 font-normal">(paste into Arduino config)</span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2
                             text-sm break-all text-slate-700">
              {endpoint}
            </code>
            <button
              onClick={copyEndpoint}
              className="shrink-0 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg
                         hover:bg-blue-700 transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Token — link to Devices page */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500 mb-1">
            2 · Device Token <span className="text-slate-400 font-normal">(paste into Arduino config → JWT Token field)</span>
          </p>
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100
                          rounded-lg px-4 py-3">
            <span className="text-xl">📡</span>
            <div className="flex-1 text-xs text-blue-800">
              Tokens are now managed per-device in the{" "}
              <Link href="/devices" className="font-semibold underline underline-offset-2">
                Devices
              </Link>{" "}
              page. Add your device there to generate a token, then copy and paste it into
              the Arduino config UI.
            </div>
            <Link
              href="/devices"
              className="shrink-0 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg
                         hover:bg-blue-700 transition-colors"
            >
              Go to Devices →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick guide */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4">
        <h2 className="font-semibold text-slate-800 mb-3">Quick Setup Guide</h2>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>Flash <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">EspNfcReader.ino</code> to the ESP8266 D1 Mini.</li>
          <li>Go to <Link href="/devices" className="text-blue-600 hover:underline">Devices</Link> → <strong>Add Device</strong> — copy the generated token (shown once only).</li>
          <li>On first boot the device creates a hotspot: <strong>NFC-Attendance-Config</strong> (password: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">admin1234</code>).</li>
          <li>Connect to the hotspot and open <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">192.168.4.1</code>.</li>
          <li>Paste the <strong>Endpoint URL</strong> (from above) and the <strong>Token</strong> into the form. Add your WiFi credentials and save.</li>
          <li>Device restarts in <strong>Reader mode</strong>. Add employees on the <Link href="/employees" className="text-blue-600 hover:underline">Employees</Link> page.</li>
          <li>To program a card: set device to <strong>Writer mode</strong> in the device config UI → open <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">192.168.x.x/write</code> → tap a blank card.</li>
          <li>Switch back to <strong>Reader mode</strong> — tapping a programmed card logs attendance.</li>
        </ol>
      </div>

      {/* NeoPixel legend */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <h2 className="font-semibold text-slate-800 mb-3">NeoPixel LED Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { led: "LED 0", desc: "WiFi",             bullets: ["🔵 Blue = connected", "🟢 Blinking green = connecting", "🔴 Red = failed"] },
            { led: "LED 1", desc: "Mode / Status",    bullets: ["🔵 Blue = reader ready", "🟣 Purple = writer ready", "🔴 Red = HTTP error"] },
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


 