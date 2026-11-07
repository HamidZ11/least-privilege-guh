"use client";

import { useRef, useState, type DragEvent } from "react";
import {
  runEcho,
  upload,
  type EchoResult,
  type UploadResponse,
} from "@/lib/api";

const BUTTON =
  "h-9 rounded-lg bg-stone-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600";

const BLOCKED_TITLES = {
  blocked_input: "Blocked before reaching the agent",
  blocked_output: "Agent output blocked",
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function Home() {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [session, setSession] = useState<UploadResponse | null>(null);
  const [result, setResult] = useState<EchoResult | null>(null);
  const [busy, setBusy] = useState<"upload" | "echo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasInput = file !== null || text.trim() !== "";

  // Any edit makes the uploaded session stale, so step 2 starts over.
  function resetRun() {
    setSession(null);
    setResult(null);
    setError(null);
  }

  function chooseFile(next: File | null) {
    setFile(next);
    resetRun();
    if (fileInput.current) fileInput.current.value = "";
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped) chooseFile(dropped);
  }

  async function handleUpload() {
    resetRun();
    setBusy("upload");
    try {
      setSession(await upload(file ?? text));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    if (!session) return;
    setResult(null);
    setError(null);
    setBusy("echo");
    try {
      setResult(await runEcho(session.session_id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <h1 className="text-2xl font-semibold tracking-tight">Echo agent</h1>
      <p className="mt-1 text-sm text-stone-600">
        Upload text, then run it through the guardrails and a one-line summary.
      </p>

      <section className="mt-8" aria-labelledby="input-heading">
        <h2 id="input-heading" className="text-sm font-medium">
          1. Add your text
        </h2>
        <div
          className="mt-2 rounded-xl border border-stone-300 bg-white focus-within:border-stone-900"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          {file ? (
            <div className="flex h-40 items-center justify-between gap-4 px-4">
              <span className="min-w-0 truncate text-sm font-medium">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => chooseFile(null)}
                className="shrink-0 rounded text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900"
              >
                Remove
              </button>
            </div>
          ) : (
            <textarea
              aria-label="Text to upload"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                resetRun();
              }}
              placeholder="Paste text, markdown or code, or drop a file here"
              className="block h-40 w-full resize-none rounded-t-xl bg-transparent p-4 text-sm leading-6 outline-none placeholder:text-stone-500"
            />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-stone-200 p-2 pl-4">
            <label className="cursor-pointer rounded text-sm text-stone-600 underline underline-offset-2 hover:text-stone-900 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-stone-900">
              Choose a file
              <input
                ref={fileInput}
                type="file"
                className="sr-only"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!hasInput || busy !== null}
              className={BUTTON}
            >
              {busy === "upload" ? "Uploading…" : "Upload"}
            </button>
          </div>
        </div>
      </section>

      <section
        className="mt-8 border-t border-stone-200 pt-6"
        aria-labelledby="run-heading"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="run-heading" className="text-sm font-medium">
              2. Run the agent
            </h2>
            <p className="mt-0.5 text-sm text-stone-600" aria-live="polite">
              {session
                ? `Uploaded ${session.chars.toLocaleString()} characters`
                : "Upload something first"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={!session || busy !== null}
            className={`${BUTTON} shrink-0`}
          >
            {busy === "echo" ? "Running…" : "Run echo agent"}
          </button>
        </div>

        <div aria-live="polite">
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}

          {result?.status === "ok" && (
            <div className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-3">
              <h3 className="text-xs font-medium text-stone-600">Summary</h3>
              <p className="mt-1 text-sm leading-6 wrap-anywhere">
                {result.output}
              </p>
            </div>
          )}

          {result && result.status !== "ok" && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <h3 className="font-medium">{BLOCKED_TITLES[result.status]}</h3>
              <ul className="mt-1 list-disc pl-4">
                {result.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
