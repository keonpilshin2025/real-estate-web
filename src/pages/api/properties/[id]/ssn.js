import { env } from "cloudflare:workers";
import { getDb } from "../../../../lib/db.js";
import { decryptText } from "../../../../lib/crypto.js";

export const prerender = false;

// GET /api/properties/{id}/ssn  -> { ssn: "990101-1234567" }
export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT owner_ssn_encrypted FROM properties WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }
  if (!row.owner_ssn_encrypted) {
    return new Response(JSON.stringify({ error: "등록된 주민번호가 없습니다." }), { status: 404 });
  }

  const ssn = await decryptText(row.owner_ssn_encrypted, env);

  return new Response(JSON.stringify({ ssn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}