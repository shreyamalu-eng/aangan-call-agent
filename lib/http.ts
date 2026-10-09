/** fetch with a timeout and a readable error, used by every provider client. */
export async function fetchJson<T = any>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 10000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    if (!res.ok) {
      const msg = typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300);
      throw new Error(`${init.method ?? "GET"} ${new URL(url).host}${new URL(url).pathname} → ${res.status}: ${msg}`);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}
