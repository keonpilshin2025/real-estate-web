import { neon } from "@neondatabase/serverless";

/**
 * Astro API route / middleware 어디서든:
 *   const sql = getDb(Astro.locals.runtime.env.DATABASE_URL);
 *   const rows = await sql`SELECT * FROM clients`;
 */
export function getDb(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL이 설정되지 않았습니다.");
  }
  return neon(databaseUrl);
}
