const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type UploadResponse = {
  session_id: string;
  chars: number;
};

export type EchoResult = {
  status: "ok" | "blocked_input" | "blocked_output";
  output: string | null;
  reasons: string[];
};

export type Session = {
  id: string;
  text?: string;
  chars?: number;
  filename?: string | null;
  echo?: EchoResult;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Can't reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : null;
    throw new Error(detail ?? `Request failed (${response.status})`);
  }
  return response.json();
}

export function upload(input: File | string): Promise<UploadResponse> {
  const form = new FormData();
  form.append(input instanceof File ? "file" : "text", input);
  return request("/api/upload", { method: "POST", body: form });
}

export function runEcho(sessionId: string): Promise<EchoResult> {
  return request("/api/agent/echo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}

export function getSession(sessionId: string): Promise<Session> {
  return request(`/api/session/${encodeURIComponent(sessionId)}`);
}
