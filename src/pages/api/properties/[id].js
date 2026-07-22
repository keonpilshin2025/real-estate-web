import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";
import { decryptToMasked } from "../../../lib/crypto.js";

export const prerender = false;

export async function GET({ params, request }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const url = new URL(request.url);
  const clientIdParam = url.searchParams.get("client_id");
  const contextClientId = clientIdParam ? Number(clientIdParam) : null;

  const [row] = await sql`
    SELECT
      p.*,
      pa.agency_name AS partner_agency_name,
      c.id AS active_contract_id,
      c.contract_type AS final_contract_type,
      c.price AS final_price,
      c.deposit AS final_deposit,
      c.monthly_rent AS final_monthly_rent,
      c.balance_date AS final_balance_date,
      c.deal_status AS final_deal_status
    FROM properties p
    LEFT JOIN partner_agencies pa ON pa.id = p.partner_agency_id
    LEFT JOIN LATERAL (
      SELECT * FROM contracts c2
      WHERE c2.property_id = p.id
        AND c2.is_deleted = FALSE
        AND (
          -- client_id가 지정되면 정확히 그 계약(그 시점 그대로)을, 아니면 현재 진행 중인 계약을 사용
          (${contextClientId}::int IS NOT NULL AND c2.client_id = ${contextClientId})
          OR (${contextClientId}::int IS NULL AND (c2.balance_date IS NULL OR c2.balance_date >= now()))
        )
      ORDER BY c2.created_at DESC
      LIMIT 1
    ) c ON true
    WHERE p.id = ${id}
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }

  const owners = await sql`
    SELECT oc.id, oc.name, oc.phone, oc.ssn_encrypted, po.is_primary
    FROM property_owners po
    JOIN clients oc ON oc.id = po.client_id
    WHERE po.property_id = ${id}
    ORDER BY po.is_primary DESC, po.id
  `;
  const ownersSafe = await Promise.all(
    owners.map(async (o) => {
      const { ssn_encrypted, ...rest } = o;
      const ssn_masked = ssn_encrypted ? await decryptToMasked(ssn_encrypted, env) : null;
      return { ...rest, ssn_masked };
    })
  );

  const { owner_ssn_encrypted, ...rest } = row;
  const owner_ssn_masked = owner_ssn_encrypted ? await decryptToMasked(owner_ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, owner_ssn_masked, owners: ownersSafe }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT({ request, params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const body = await request.json();

  const {
    property_name, property_type, dong, ho, address,
    unit_type, usage_type, features, memo,
    transaction_type, asking_price, asking_deposit, asking_monthly_rent,
    owner_client_ids, primary_owner_client_id, partner_agency_id,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const ownerIds = Array.isArray(owner_client_ids) ? owner_client_ids.map(toInt).filter((v) => v !== null) : [];
  const primaryId = toInt(primary_owner_client_id) ?? (ownerIds.length > 0 ? ownerIds[0] : null);

  const [row] = await sql`
    UPDATE properties SET
      property_name = ${property_name}, property_type = ${property_type},
      dong = ${dong || null}, ho = ${ho || null}, address = ${address || null},
      unit_type = ${unit_type || null}, usage_type = ${usage_type || null},
      features = ${features || null}, memo = ${memo || null},
      transaction_type = ${transaction_type || null},
      asking_price = ${toInt(asking_price)}, asking_deposit = ${toInt(asking_deposit)},
      asking_monthly_rent = ${toInt(asking_monthly_rent)},
      partner_agency_id = ${toInt(partner_agency_id)},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }

  // 소유자 목록 전체 교체 (기존 것 지우고 새로 등록된 목록으로)
  await sql`DELETE FROM property_owners WHERE property_id = ${id}`;
  for (const cid of ownerIds) {
    await sql`
      INSERT INTO property_owners (property_id, client_id, is_primary)
      VALUES (${id}, ${cid}, ${cid === primaryId})
      ON CONFLICT DO NOTHING
    `;
  }

  const { owner_ssn_encrypted, ...rest } = row;
  const owner_ssn_masked = owner_ssn_encrypted ? await decryptToMasked(owner_ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, owner_ssn_masked, owner_client_ids: ownerIds }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);

  const [{ count }] = await sql`
    SELECT COUNT(*)::int AS count FROM contracts WHERE property_id = ${id} AND is_deleted = FALSE
  `;
  if (count > 0) {
    return new Response(
      JSON.stringify({ error: `이 매물에 연결된 계약이 ${count}건 있어 삭제할 수 없습니다. 먼저 계약을 삭제해주세요.` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  await sql`DELETE FROM properties WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}