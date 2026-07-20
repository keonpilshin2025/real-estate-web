import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT * FROM partner_agencies WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 부동산을 찾을 수 없습니다." }), { status: 404 });
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
  const { agency_name, phone, mobile_phone, address } = body;

  if (!agency_name) {
    return new Response(JSON.stringify({ error: "부동산명은 필수입니다." }), { status: 400 });
  }

  const [row] = await sql`
    UPDATE partner_agencies SET
      agency_name = ${agency_name},
      phone = ${phone || null},
      mobile_phone = ${mobile_phone || null},
      address = ${address || null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 부동산을 찾을 수 없습니다." }), { status: 404 });
  }

  return new Response(JSON.stringify(row), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  await sql`DELETE FROM partner_agencies WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
