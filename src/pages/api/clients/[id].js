import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT * FROM clients WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 고객을 찾을 수 없습니다." }), { status: 404 });
  }
  return new Response(JSON.stringify(row), {
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
    transaction_type, budget_range, desired_move_in_month,
  } = body;

  if (name && !/^[가-힣]+$/.test(name)) {
    return new Response(JSON.stringify({ error: "이름은 한글만 입력 가능합니다." }), { status: 400 });
  }

  const [row] = await sql`
    UPDATE clients SET
      name = ${name},
      phone = ${phone || null},
      description = ${description || null},
      address = ${address || null},
      memo = ${memo || null},
      transaction_type = ${transaction_type || null},
      budget_range = ${budget_range || null},
      desired_move_in_month = ${desired_move_in_month || null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 고객을 찾을 수 없습니다." }), { status: 404 });
  }

  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  await sql`DELETE FROM clients WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}