import { env } from "cloudflare:workers";
import { getDb } from "../../../../lib/db.js";
import { decryptText } from "../../../../lib/crypto.js";

export const prerender = false;

// GET /api/clients/{id}/ssn  -> { ssn: "990101-1234567" }
// 이 엔드포인트를 호출할 때만 평문이 응답에 포함됩니다. (목록/일반 상세조회에는 절대 포함 안 됨)
export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT ssn_encrypted FROM clients WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 고객을 찾을 수 없습니다." }), { status: 404 });
  }
  if (!row.ssn_encrypted) {
    return new Response(JSON.stringify({ error: "등록된 주민번호가 없습니다." }), { status: 404 });
  }

  const ssn = await decryptText(row.ssn_encrypted, env);

  return new Response(JSON.stringify({ ssn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}