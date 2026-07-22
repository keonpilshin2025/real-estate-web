import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";
import { encryptText, decryptToMasked } from "../../../lib/crypto.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT * FROM clients WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 고객을 찾을 수 없습니다." }), { status: 404 });
  }

  const { ssn_encrypted, ...rest } = row;
  const ssn_masked = ssn_encrypted ? await decryptToMasked(ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, ssn_masked, has_ssn: !!ssn_encrypted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT({ request, params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const body = await request.json();
  const {
    name, phone, description, address, memo,
    transaction_type, budget_range, desired_move_in_month, ssn,
  } = body;

  // ssn이 비어있으면(수정 안 함) 기존 값 유지, 값이 있으면 새로 암호화해서 교체
  let ssnUpdateClause;
  if (ssn) {
    const ssnEncrypted = await encryptText(ssn, env);
    ssnUpdateClause = ssnEncrypted;
  }

  const [row] = ssn
    ? await sql`
        UPDATE clients SET
          name = ${name}, phone = ${phone || null}, description = ${description || null},
          address = ${address || null}, memo = ${memo || null},
          transaction_type = ${transaction_type || null}, budget_range = ${budget_range || null},
          desired_move_in_month = ${desired_move_in_month || null},
          ssn_encrypted = ${ssnUpdateClause},
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `
    : await sql`
        UPDATE clients SET
          name = ${name}, phone = ${phone || null}, description = ${description || null},
          address = ${address || null}, memo = ${memo || null},
          transaction_type = ${transaction_type || null}, budget_range = ${budget_range || null},
          desired_move_in_month = ${desired_move_in_month || null},
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 고객을 찾을 수 없습니다." }), { status: 404 });
  }

  const { ssn_encrypted, ...rest } = row;
  const ssn_masked = ssn_encrypted ? await decryptToMasked(ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, ssn_masked, has_ssn: !!ssn_encrypted }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);

  const [{ count: contractCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM contracts WHERE client_id = ${id} AND is_deleted = FALSE
  `;
  const [{ count: ownerCount }] = await sql`
    SELECT COUNT(*)::int AS count FROM properties WHERE owner_client_id = ${id}
  `;

  if (contractCount > 0 || ownerCount > 0) {
    const parts = [];
    if (contractCount > 0) parts.push(`연결된 계약 ${contractCount}건`);
    if (ownerCount > 0) parts.push(`매도자/임대인으로 연결된 매물 ${ownerCount}건`);
    return new Response(
      JSON.stringify({ error: `${parts.join(", ")}이 있어 삭제할 수 없습니다. 먼저 연결을 해제해주세요.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await sql`DELETE FROM clients WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}