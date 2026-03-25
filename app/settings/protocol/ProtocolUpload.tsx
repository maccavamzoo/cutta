"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { validateProtocol, ProtocolFile } from "@/lib/protocol";

interface Props {
  hasActiveProtocol: boolean;
}

export default function ProtocolUpload({ hasActiveProtocol }: Props) {
  const [parsed, setParsed] = useState<ProtocolFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setUploadError(null);
    setParsed(null);
    setSuccess(false);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        const result = validateProtocol(raw);
        if (!result.valid) {
          setParseError(result.error);
        } else {
          setParsed(result.data);
        }
      } catch {
        setParseError("Could not parse file — make sure it's valid JSON.");
      }
    };
    reader.readAsText(file);
  }

  async function handleUpload() {
    if (!parsed) return;
    setUploading(true);
    setUploadError(null);

    const res = await fetch("/api/protocol", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();

    if (!res.ok) {
      setUploadError(data.error ?? "Upload failed. Please try again.");
      setUploading(false);
      return;
    }

    setParsed(null);
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* File input */}
      <label className="block">
        <span className="sr-only">Choose protocol JSON file</span>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          className="block w-full text-sm text-zinc-400
            file:mr-4 file:py-2 file:px-4
            file:rounded-lg file:border-0
            file:text-sm file:font-medium
            file:bg-zinc-800 file:text-white
            hover:file:bg-zinc-700 file:cursor-pointer cursor-pointer"
        />
      </label>

      {/* Parse error */}
      {parseError && (
        <p className="text-red-400 text-sm">{parseError}</p>
      )}

      {/* Parsed preview */}
      {parsed && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 space-y-3">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">Preview</p>

          <div>
            <p className="text-xs text-zinc-500 mb-0.5">Protocol name</p>
            <p className="text-white font-semibold">{parsed.protocol_name}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {parsed.target_weight_kg !== undefined && (
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Target weight</p>
                <p className="text-zinc-200 text-sm">{parsed.target_weight_kg} kg</p>
              </div>
            )}
            {parsed.max_weekly_loss_kg !== undefined && (
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Max loss / week</p>
                <p className="text-zinc-200 text-sm">{parsed.max_weekly_loss_kg} kg</p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              {Object.keys(parsed).length} fields detected
            </p>
            <p className="text-xs text-lime-500">Valid ✓</p>
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <p className="text-red-400 text-sm">{uploadError}</p>
      )}

      {/* Upload button */}
      {parsed && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full py-3 rounded-xl bg-lime-400 text-black font-semibold text-sm
            disabled:opacity-50 disabled:cursor-not-allowed
            hover:bg-lime-300 active:bg-lime-500 transition-colors"
        >
          {uploading
            ? "Saving..."
            : hasActiveProtocol
            ? "Replace active protocol"
            : "Activate protocol"}
        </button>
      )}

      {/* Success message */}
      {success && (
        <p className="text-lime-400 text-sm text-center font-medium">
          Protocol activated.
        </p>
      )}
    </div>
  );
}
