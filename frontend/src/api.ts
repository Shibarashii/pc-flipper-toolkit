export type BuildStatus = "planning" | "building" | "listed" | "sold";

export type Build = {
  id: number;
  name: string;
  status: BuildStatus;
  selling_price: string | null;
  sold_at: string | null;
  notes: string;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    // Only send Content-Type with a body, so plain GETs need no CORS preflight.
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const listBuilds = () => request<Build[]>("/builds/");

export const getBuild = (id: number) => request<Build>(`/builds/${id}/`);

export const createBuild = (name: string) =>
  request<Build>("/builds/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
