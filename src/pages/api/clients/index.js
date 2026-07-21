import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";
import { encryptText, decryptToMasked } from "../../../lib/crypto.js";

export const prerender = false;

// GET /api/clients?q=검색어&limit=10000
// 응답에는 절대 평문 주민번호를 포함하지 않고, ssn_masked(마스킹된 값)만 내려줍니다.
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : 20;

  const rows = await sql`
    SELECT * FROM clients
    WHERE (${q} = '' OR name ILIKE ${'%' + q + '%'} OR phone ILIKE ${'%' + q + '%'})
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const withMasked = await Promise.all(
    rows.map(async (row) => {
      const { ssn_encrypted, ...rest } = row;
      const ssn_masked = ssn_encrypted ? await decryptToMasked(ssn_encrypted, env) : null;
      return { ...rest, ssn_masked };
    })
  );

  return new Response(JSON.stringify(withMasked), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/clients
export async function POST({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const body = await request.json();
  const {
    name, phone, description, address, memo,
    transaction_type, budget_range, desired_move_in_month, ssn,
  } = body;

  if (!name) {
    return new Response(JSON.stringify({ error: "이름은 필수입니다." }), { status: 400 });
  }
  if (!/^[가-힣]+$/.test(name)) {
    return new Response(JSON.stringify({ error: "이름은 한글만 입력 가능합니다." }), { status: 400 });
  }

  const ssnEncrypted = ssn ? await encryptText(ssn, env) : null;

  const [row] = await sql`
    INSERT INTO clients
      (name, phone, description, address, memo, transaction_type, budget_range, desired_move_in_month, ssn_encrypted)
    VALUES
      (${name}, ${phone || null}, ${description || null}, ${address || null}, ${memo || null},
       ${transaction_type || null}, ${budget_range || null}, ${desired_move_in_month || null}, ${ssnEncrypted})
    RETURNING *
  `;

  const { ssn_encrypted, ...safeRow } = row;

  return new Response(JSON.stringify(safeRow), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}