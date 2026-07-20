import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/properties?q=검색어&type=아파트&limit=10000
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const type = url.searchParams.get("type") || "";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10000) : 20;

  const rows = await sql`
    SELECT p.*, pa.agency_name AS partner_agency_name
    FROM properties p
    LEFT JOIN partner_agencies pa ON pa.id = p.partner_agency_id
    WHERE
      (${type} = '' OR p.property_type = ${type})
      AND (${q} = '' OR p.property_name ILIKE ${'%' + q + '%'} OR p.address ILIKE ${'%' + q + '%'})
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/properties
export async function POST({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const body = await request.json();

  const {
    property_name, property_type, dong, ho, address,
    unit_type, usage_type, features, memo,
    transaction_type, asking_price, asking_deposit, asking_monthly_rent,
    owner_name, owner_phone, partner_agency_id,
  } = body;

  if (!property_name || !property_type) {
    return new Response(JSON.stringify({ error: "매물명과 매물구분은 필수입니다." }), { status: 400 });
  }

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));

  const [row] = await sql`
    INSERT INTO properties
      (property_name, property_type, dong, ho, address, unit_type, usage_type, features, memo,
       transaction_type, asking_price, asking_deposit, asking_monthly_rent,
       owner_name, owner_phone, partner_agency_id)
    VALUES
      (${property_name}, ${property_type}, ${dong || null}, ${ho || null}, ${address || null},
       ${unit_type || null}, ${usage_type || null}, ${features || null}, ${memo || null},
       ${transaction_type || null}, ${toInt(asking_price)}, ${toInt(asking_deposit)}, ${toInt(asking_monthly_rent)},
       ${owner_name || null}, ${owner_phone || null}, ${toInt(partner_agency_id)})
    RETURNING *
  `;

  return new Response(JSON.stringify(row), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}