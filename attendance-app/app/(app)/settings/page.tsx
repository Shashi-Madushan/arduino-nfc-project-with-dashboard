"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cpu } from "lucide-react";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);
  const [cutoff, setCutoff] = useState("10:00");
  const [tempCutoff, setTempCutoff] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cutoffHistory, setCutoffHistory] = useState<Array<{ time: string, cutoff: string, changedBy: string }>>([]);

  // load existing setting
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.setting?.orderCutoff) {
          setCutoff(data.setting.orderCutoff);
          setTempCutoff(data.setting.orderCutoff);
        }
      } catch (e) {}
    })();
  }, []);

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/attendance`
      : "https://your-app.vercel.app/api/attendance";

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function validateTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  async function saveCutoff() {
    if (!validateTimeFormat(tempCutoff)) {
      setMessage({ type: 'error', text: 'Invalid time format. Use HH:MM format (e.g., 09:30)' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/settings', { 
        method: 'POST', 
        body: JSON.stringify({ orderCutoff: tempCutoff }), 
        headers: { 'Content-Type': 'application/json' } 
      });
      
      if (!res.ok) {
        throw new Error('Failed to save');
      }
      
      const data = await res.json();
      setCutoff(data.setting.orderCutoff);
      setTempCutoff(data.setting.orderCutoff);
      
      // Add to history
      const newEntry = {
        time: new Date().toLocaleString(),
        cutoff: data.setting.orderCutoff,
        changedBy: 'Admin'
      };
      setCutoffHistory(prev => [newEntry, ...prev.slice(0, 9)]); // Keep last 10 entries
      
      setMessage({ type: 'success', text: `Cutoff time updated to ${data.setting.orderCutoff}` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save cutoff time' });
    } finally {
      setSaving(false);
    }
  }

  function resetCutoff() {
    setTempCutoff(cutoff);
    setMessage(null);
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
            <code className="bg-slate-100 px-1 py-0.5 rounded">NFC-Canteen-Config</code>) and
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
            <span className="text-blue-600"><Cpu size={20} /></span>
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

      {/* Canteen settings */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-4">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800 mb-1">Order Cutoff Time Management</h2>
              <p className="text-xs text-slate-500">Configure when ordering switches to collection mode. Before cutoff: orders, After cutoff: collections.</p>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
        </div>
        
        {/* Current status */}
        <div className="px-5 py-3 bg-slate-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Current cutoff time:</span>
            <span className="text-sm font-semibold text-slate-900 bg-white px-3 py-1 rounded border border-slate-200">
              {cutoff} (Sri Lanka Time)
            </span>
          </div>
        </div>

        {/* Edit form */}
        <div className="px-5 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 min-w-20">New time:</label>
              <input
                type="time"
                value={tempCutoff}
                onChange={(e) => setTempCutoff(e.target.value)}
                className={`px-3 py-2 border rounded-lg text-sm flex-1 max-w-32 ${
                  validateTimeFormat(tempCutoff) 
                    ? 'border-slate-300 focus:ring-blue-500 focus:border-blue-500' 
                    : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                } focus:outline-none focus:ring-2`}
              />
              <span className="text-xs text-slate-500">Sri Lanka Time (GMT+5:30)</span>
            </div>
            
            {/* Validation message */}
            {!validateTimeFormat(tempCutoff) && (
              <div className="text-xs text-red-600 ml-24">
                ⚠️ Invalid time format. Use HH:MM format (e.g., 09:30)
              </div>
            )}

            {/* Success/Error message */}
            {message && (
              <div className={`text-xs px-3 py-2 rounded-lg ml-24 ${
                message.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {message.type === 'success' ? '✅' : '❌'} {message.text}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 ml-24">
              <button
                onClick={saveCutoff}
                disabled={saving || !validateTimeFormat(tempCutoff) || tempCutoff === cutoff}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Update Cutoff'}
              </button>
              <button
                onClick={resetCutoff}
                disabled={tempCutoff === cutoff}
                className="px-4 py-2 border border-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* History section */}
        {showHistory && (
          <div className="px-5 py-4 border-t border-slate-100">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Recent Changes</h3>
            {cutoffHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No changes recorded yet</p>
            ) : (
              <div className="space-y-2">
                {cutoffHistory.map((entry, index) => (
                  <div key={index} className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-600">{entry.cutoff}</span>
                      <span className="text-slate-400">by {entry.changedBy}</span>
                    </div>
                    <span className="text-slate-400">{entry.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick guide */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-4">
        <h2 className="font-semibold text-slate-800 mb-3">Quick Setup Guide</h2>
        <ol className="space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>Flash <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">EspNfcReader.ino</code> to the ESP8266 D1 Mini.</li>
          <li>Go to <Link href="/devices" className="text-blue-600 hover:underline">Devices</Link> → <strong>Add Device</strong> — copy the generated token (shown once only).</li>
          <li>On first boot the device creates a hotspot: <strong>NFC-Canteen-Config</strong> (password: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">admin1234</code>).</li>
          <li>Connect to the hotspot and open <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">192.168.4.1</code>.</li>
          <li>Paste the <strong>Endpoint URL</strong> (from above) and the <strong>Token</strong> into the form. Add your WiFi credentials and save.</li>
          <li>Device restarts in <strong>Reader mode</strong>. Add employees on the <Link href="/employees" className="text-blue-600 hover:underline">Employees</Link> page.</li>
          <li>To program a card: set device to <strong>Writer mode</strong> in the device config UI → open <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">192.168.x.x/write</code> → tap a blank card.</li>
          <li>Switch back to <strong>Reader mode</strong> — tapping a programmed card records an order before cutoff, and marks collection after cutoff.</li>
        </ol>
      </div>

      {/* NeoPixel legend */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
        <h2 className="font-semibold text-slate-800 mb-3">NeoPixel LED Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { led: "LED 0", desc: "WiFi", bullets: [
              { color: "bg-blue-500",  text: "Blue = connected" },
              { color: "bg-green-500", text: "Blinking green = connecting" },
              { color: "bg-red-500",   text: "Red = failed" },
            ]},
            { led: "LED 1", desc: "Mode / Status", bullets: [
              { color: "bg-blue-500",   text: "Blue = reader ready" },
              { color: "bg-purple-500", text: "Purple = writer ready" },
              { color: "bg-red-500",    text: "Red = HTTP error" },
            ]},
            { led: "LED 2+3", desc: "Operation Result", bullets: [
              { color: "bg-green-500",  text: "Green = success (200/201)" },
              { color: "bg-yellow-400", text: "Yellow = unknown card (404)" },
              { color: "bg-red-500",    text: "Red = error / idle" },
            ]},
          ].map(({ led, desc, bullets }) => (
            <div key={led} className="bg-slate-50 rounded-lg p-3">
              <p className="font-semibold text-slate-700 mb-1">{led} — {desc}</p>
              <ul className="space-y-1 text-slate-600">
                {bullets.map((b) => (
                  <li key={b.text} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.color}`} />
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


 