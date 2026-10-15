export const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4001";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${REALTIME_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const candidate = data && typeof data === "object" && "error" in data ? (data as { error?: { message?: unknown } }).error?.message : undefined;
    const message = typeof candidate === "string" ? candidate : undefined;
    throw new Error(message || "The theater service is unavailable.");
  }
  return data as T;
}
