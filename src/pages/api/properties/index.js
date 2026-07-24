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
    SELECT
      p.id, p.unit_id, p.features, p.memo, p.transaction_type,
      p.asking_price, p.asking_deposit, p.asking_monthly_rent,
      p.partner_agency_id, p.created_at, p.updated_at,
      u.property_name, u.property_type, u.dong, u.ho, u.unit_type, u.usage_type, u.address,
      pa.agency_name AS partner_agency_name,
      COALESCE(
        (
          SELECT json_agg(json_build_object('id', oc.id, 'name', oc.name, 'phone', oc.phone, 'is_primary', po.is_primary) ORDER BY po.is_primary DESC, po.id)
          FROM property_owners po
          JOIN clients oc ON oc.id = po.client_id
          WHERE po.property_id = p.id AND po.removed_at IS NULL
        ),
        '[]'
      ) AS owners
    FROM properties p
    JOIN real_estate_units u ON u.id = p.unit_id
    LEFT JOIN partner_agencies pa ON pa.id = p.partner_agency_id
    WHERE
      (${type} = '' OR u.property_type = ${type})
      AND (${q} = '' OR u.property_name ILIKE ${'%' + q + '%'} OR u.dong ILIKE ${'%' + q + '%'} OR u.ho ILIKE ${'%' + q + '%'} OR u.address ILIKE ${'%' + q + '%'})
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
    unit_id, features, memo,
    transaction_type, asking_price, asking_deposit, asking_monthly_rent,
    owner_client_ids, primary_owner_client_id, partner_agency_id,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const unitIdInt = toInt(unit_id);

  if (!unitIdInt) {
    return new Response(JSON.stringify({ error: "물건을 먼저 검색해서 선택해주세요." }), { status: 400 });
  }

  const [unit] = await sql`SELECT id FROM real_estate_units WHERE id = ${unitIdInt}`;
  if (!unit) {
    return new Response(JSON.stringify({ error: "선택한 물건을 찾을 수 없습니다." }), { status: 404 });
  }

  // 이 물건에 이미 매물이 연결되어 있는지 미리 정확하게 확인 (에러 메시지 오판 방지)
  const [existing] = await sql`SELECT id FROM properties WHERE unit_id = ${unitIdInt}`;
  if (existing) {
    return new Response(
      JSON.stringify({ error: "이 물건에는 이미 매물이 등록되어 있습니다. 매물 탭에서 검색해서 수정해주세요." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const ownerIds = Array.isArray(owner_client_ids) ? owner_client_ids.map(toInt).filter((v) => v !== null) : [];
  const primaryId = toInt(primary_owner_client_id) ?? (ownerIds.length > 0 ? ownerIds[0] : null);

  let row;
  try {
    [row] = await sql`
      INSERT INTO properties
        (unit_id, features, memo, transaction_type, asking_price, asking_deposit, asking_monthly_rent, partner_agency_id)
      VALUES
        (${unitIdInt}, ${features || null}, ${memo || null},
         ${transaction_type || null}, ${toInt(asking_price)}, ${toInt(asking_deposit)}, ${toInt(asking_monthly_rent)},
         ${toInt(partner_agency_id)})
      RETURNING *
    `;
  } catch (e) {
    // 위에서 미리 확인했는데도 여기서 또 실패했다면, 진짜 원인이 다른 문제일 수 있으니 그대로 보여줌 (디버깅용)
    const message = e?.message || String(e);
    const isDup = /unit_id|unique/i.test(message);
    return new Response(
      JSON.stringify({
        error: isDup
          ? "이 물건에는 이미 매물이 등록되어 있습니다. 매물 탭에서 검색해서 수정해주세요."
          : `저장 중 오류가 발생했습니다: ${message}`,
      }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  for (const cid of ownerIds) {
    await sql`
      INSERT INTO property_owners (property_id, client_id, is_primary)
      VALUES (${row.id}, ${cid}, ${cid === primaryId})
      ON CONFLICT (property_id, client_id) DO UPDATE SET removed_at = NULL, is_primary = ${cid === primaryId}
    `;
  }

  return new Response(JSON.stringify({ ...row, owner_client_ids: ownerIds }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}