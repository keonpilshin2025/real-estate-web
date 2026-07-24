import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/units?q=검색어&limit=10000
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : 20;

  const rows = await sql`
    SELECT
      u.*,
      p.id AS property_id
    FROM real_estate_units u
    LEFT JOIN properties p ON p.unit_id = u.id
    WHERE
      (${q} = '' OR u.property_name ILIKE ${'%' + q + '%'} OR u.dong ILIKE ${'%' + q + '%'} OR u.ho ILIKE ${'%' + q + '%'} OR u.address ILIKE ${'%' + q + '%'})
    ORDER BY u.created_at DESC
    LIMIT ${limit}
  `;

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/units
export async function POST({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const body = await request.json();
  const { property_name, property_type, dong, ho, unit_type, unit_sqm, usage_type, address } = body;

  if (!property_name || !property_type) {
    return new Response(JSON.stringify({ error: "매물명과 매물구분은 필수입니다." }), { status: 400 });
  }

  // 중복 물건 체크: 동/호수가 있으면 매물명+동+호수 일치, 없으면 매물명+주소 일치
  const dupRows = dong && ho
    ? await sql`SELECT id FROM real_estate_units WHERE property_name = ${property_name} AND dong = ${dong} AND ho = ${ho} LIMIT 1`
    : address
      ? await sql`SELECT id FROM real_estate_units WHERE property_name = ${property_name} AND address = ${address} LIMIT 1`
      : [];

  if (dupRows.length > 0) {
    return new Response(
      JSON.stringify({ error: "이미 등록된 물건입니다 (같은 매물명·동·호수)." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const [row] = await sql`
    INSERT INTO real_estate_units (property_name, property_type, dong, ho, unit_type, unit_sqm, usage_type, address)
    VALUES (${property_name}, ${property_type}, ${dong || null}, ${ho || null}, ${unit_type || null}, ${unit_sqm || null}, ${usage_type || null}, ${address || null})
    RETURNING *
  `;

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}