import { env } from "cloudflare:workers";
import { getDb } from "../../lib/db.js";

export const prerender = false;

// GET /api/health
// 아주 가벼운 쿼리 하나로 Neon DB 컴퓨트를 깨워두는 용도. 민감 정보 없음, 인증 불필요.
export async function GET() {
  try {
    const sql = getDb(env.DATABASE_URL);
    await sql`SELECT 1`;
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}