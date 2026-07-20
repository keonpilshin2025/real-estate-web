import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/partner-agencies?q=검색어
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";

  const rows = await sql`
    SELECT * FROM partner_agencies
    WHERE (${q} = '' OR agency_name ILIKE ${'%' + q + '%'})
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/partner-agencies
export async function POST({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const body = await request.json();
  const { agency_name, phone, mobile_phone, address } = body;

  if (!agency_name) {
    return new Response(JSON.stringify({ error: "부동산명은 필수입니다." }), { status: 400 });
  }

  const [row] = await sql`
    INSERT INTO partner_agencies (agency_name, phone, mobile_phone, address)
    VALUES (${agency_name}, ${phone || null}, ${mobile_phone || null}, ${address || null})
    RETURNING *
  `;

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
