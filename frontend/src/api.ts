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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const listBuilds = () => getJson<Build[]>("/builds/");
