export type BuildStatus = "planning" | "building" | "listed" | "sold";

/** Money and percentages arrive as decimal strings ("12500.00"), never floats. */
export type Totals = {
  listed_total: string;
  parts_cost: string;
  extra_costs: string;
  total_cost: string;
  profit: string | null;
  profit_margin: string | null;
  below_market: string | null;
  below_market_pct: string | null;
  voucher_savings: string;
};

export type Build = {
  id: number;
  name: string;
  status: BuildStatus;
  selling_price: string | null;
  sold_at: string | null;
  notes: string;
  created_at: string;
  totals: Totals;
};

export const CATEGORIES = {
  cpu: "CPU",
  gpu: "GPU",
  motherboard: "Motherboard",
  ram: "RAM",
  storage: "Storage",
  psu: "PSU",
  case: "Case",
  cooler: "Cooler",
  other: "Other",
} as const;

export type PartCategory = keyof typeof CATEGORIES;

export type Part = {
  id: number;
  build: number;
  name: string;
  category: PartCategory;
  shop: string;
  listed_price: string;
  bought_for: string;
};

export type ExtraCost = {
  id: number;
  build: number;
  label: string;
  amount: string;
};

export type BuildDetail = Build & { parts: Part[]; extra_costs: ExtraCost[] };

export type NewPart = Omit<Part, "id">;

/** DRF validation errors: field name → messages. */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }

  /** Per-field messages from a 400, or {} for any other error. */
  get fieldErrors(): FieldErrors {
    return this.status === 400 && this.body && typeof this.body === "object"
      ? (this.body as FieldErrors)
      : {};
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

export const getBuild = (id: number) => request<BuildDetail>(`/builds/${id}/`);

export const createBuild = (name: string) =>
  request<Build>("/builds/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });

export const createPart = (part: NewPart) =>
  request<Part>("/parts/", { method: "POST", body: JSON.stringify(part) });

export const updatePart = (id: number, patch: Partial<NewPart>) =>
  request<Part>(`/parts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deletePart = (id: number) =>
  request<null>(`/parts/${id}/`, { method: "DELETE" });

export type NewExtraCost = Omit<ExtraCost, "id">;

export const createExtraCost = (cost: NewExtraCost) =>
  request<ExtraCost>("/extra-costs/", {
    method: "POST",
    body: JSON.stringify(cost),
  });

export const updateExtraCost = (id: number, patch: Partial<NewExtraCost>) =>
  request<ExtraCost>(`/extra-costs/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });

export const deleteExtraCost = (id: number) =>
  request<null>(`/extra-costs/${id}/`, { method: "DELETE" });
