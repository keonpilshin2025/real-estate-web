import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`
    SELECT u.*, p.id AS property_id
    FROM real_estate_units u
    LEFT JOIN properties p ON p.unit_id = u.id
    WHERE u.id = ${id}
  `;
  if (!row) {
    return new Response(JSON.stringify({ error: "해당 물건을 찾을 수 없습니다." }), { status: 404 });
  }
  return new Response(JSON.stringify(row), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function PUT({ request, params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const body = await request.json();
  const { property_name, property_type, dong, ho, unit_type, unit_sqm, usage_type, address } = body;

  const [row] = await sql`
    UPDATE real_estate_units SET
      property_name = ${property_name}, property_type = ${property_type},
      dong = ${dong || null}, ho = ${ho || null}, unit_type = ${unit_type || null},
      unit_sqm = ${unit_sqm || null},
      usage_type = ${usage_type || null}, address = ${address || null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 물건을 찾을 수 없습니다." }), { status: 404 });
  }
  return new Response(JSON.stringify(row), { status: 200, headers: { "Content-Type": "application/json" } });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);

  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM properties WHERE unit_id = ${id}`;
  if (count > 0) {
    return new Response(
      JSON.stringify({ error: "이 물건에 연결된 매물이 있어 삭제할 수 없습니다. 먼저 매물을 삭제해주세요." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await sql`DELETE FROM real_estate_units WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}