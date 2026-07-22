import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";
import { decryptToMasked } from "../../../lib/crypto.js";

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
      p.*,
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
    LEFT JOIN partner_agencies pa ON pa.id = p.partner_agency_id
    WHERE
      (${type} = '' OR p.property_type = ${type})
      AND (${q} = '' OR p.property_name ILIKE ${'%' + q + '%'} OR p.address ILIKE ${'%' + q + '%'})
    ORDER BY p.created_at DESC
    LIMIT ${limit}
  `;

  // 과거 데이터(고객 연동 전 직접입력분)를 위한 매도자 주민번호 마스킹은 그대로 유지
  const withMasked = await Promise.all(
    rows.map(async (row) => {
      const { owner_ssn_encrypted, ...rest } = row;
      const owner_ssn_masked = owner_ssn_encrypted ? await decryptToMasked(owner_ssn_encrypted, env) : null;
      return { ...rest, owner_ssn_masked };
    })
  );

  return new Response(JSON.stringify(withMasked), {
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
    owner_client_ids, primary_owner_client_id, partner_agency_id,
  } = body;

  if (!property_name || !property_type) {
    return new Response(JSON.stringify({ error: "매물명과 매물구분은 필수입니다." }), { status: 400 });
  }

  // 중복 매물 체크: 동/호수가 있으면 매물명+동+호수 일치, 없으면(상가/기타 등) 매물명+주소 일치로 판단
  const dupRows = dong && ho
    ? await sql`
        SELECT id FROM properties
        WHERE property_name = ${property_name} AND dong = ${dong} AND ho = ${ho}
        LIMIT 1
      `
    : address
      ? await sql`
          SELECT id FROM properties
          WHERE property_name = ${property_name} AND address = ${address}
          LIMIT 1
        `
      : [];

  if (dupRows.length > 0) {
    return new Response(
      JSON.stringify({ error: "이미 등록된 매물입니다 (같은 매물명·동·호수). 매물 탭에서 검색 후 필요하면 그 매물을 수정해주세요." }),
      { status: 409, headers: { "Content-Type": "application/json" } }
    );
  }

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const ownerIds = Array.isArray(owner_client_ids) ? owner_client_ids.map(toInt).filter((v) => v !== null) : [];
  const primaryId = toInt(primary_owner_client_id) ?? (ownerIds.length > 0 ? ownerIds[0] : null);

  const [row] = await sql`
    INSERT INTO properties
      (property_name, property_type, dong, ho, address, unit_type, usage_type, features, memo,
       transaction_type, asking_price, asking_deposit, asking_monthly_rent, partner_agency_id)
    VALUES
      (${property_name}, ${property_type}, ${dong || null}, ${ho || null}, ${address || null},
       ${unit_type || null}, ${usage_type || null}, ${features || null}, ${memo || null},
       ${transaction_type || null}, ${toInt(asking_price)}, ${toInt(asking_deposit)}, ${toInt(asking_monthly_rent)},
       ${toInt(partner_agency_id)})
    RETURNING *
  `;

  for (const cid of ownerIds) {
    await sql`
      INSERT INTO property_owners (property_id, client_id, is_primary)
      VALUES (${row.id}, ${cid}, ${cid === primaryId})
      ON CONFLICT (property_id, client_id) DO UPDATE SET removed_at = NULL, is_primary = ${cid === primaryId}
    `;
  }

  const { owner_ssn_encrypted, ...safeRow } = row;

  return new Response(JSON.stringify({ ...safeRow, owner_client_ids: ownerIds }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}