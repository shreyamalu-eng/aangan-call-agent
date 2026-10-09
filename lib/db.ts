import { neon } from "@neondatabase/serverless";

let _sql: ReturnType<typeof neon> | null = null;

/** Neon HTTP client. Each query is one HTTPS round trip, so it wakes a scaled-to-zero compute on demand. */
export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

export type Row = Record<string, any>;

// Local test mode only: an embedded Postgres (PGlite) so the pipeline and pages can be exercised
// without network access. Never set in Vercel.
let _lite: any = null;
async function lite() {
  if (!_lite) {
    const { PGlite } = await import("@electric-sql/pglite");
    _lite = new PGlite(process.env.TEST_PGLITE_DIR || undefined);
  }
  return _lite;
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (process.env.TEST_PGLITE) {
    const db = await lite();
    const r = await db.query(text, params.map((p) => (Array.isArray(p) || p === null || typeof p !== "object" || p instanceof Date ? p : JSON.stringify(p))));
    return r.rows as T[];
  }
  const res = await sql().query(text, params);
  return res as unknown as T[];
}

export async function exec(text: string) {
  if (process.env.TEST_PGLITE) return (await lite()).exec(text);
  return sql().query(text);
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

export async function setting(key: string, fallback: string): Promise<string> {
  try {
    const r = await one<{ value: string }>("select value from settings where key = $1", [key]);
    return r?.value ?? fallback;
  } catch {
    return fallback;
  }
}
