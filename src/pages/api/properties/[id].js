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
      p.id, p.unit_id, p.features, p.memo, p.transaction_type,
      p.asking_price, p.asking_deposit, p.asking_monthly_rent,
      p.partner_agency_id, p.created_at, p.updated_at,
      u.property_name, u.property_type, u.dong, u.ho, u.unit_type, u.usage_type, u.address,
      pa.agency_name AS partner_agency_name,
      c.id AS active_contract_id,
      c.contract_type AS final_contract_type,
      c.price AS final_price,
      c.deposit AS final_deposit,
      c.monthly_rent AS final_monthly_rent,
      c.balance_date AS final_balance_date,
      c.deal_status AS final_deal_status,
      c.seller_name_snapshot AS final_seller_name,
      c.seller_phone_snapshot AS final_seller_phone,
      c.seller_client_id_snapshot AS final_seller_client_id
    FROM properties p
    JOIN real_estate_units u ON u.id = p.unit_id
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
    WHERE po.property_id = ${id} AND po.removed_at IS NULL
    ORDER BY po.is_primary DESC, po.id
  `;
  const ownersSafe = await Promise.all(
    owners.map(async (o) => {
      const { ssn_encrypted, ...rest } = o;
      const ssn_masked = ssn_encrypted ? await decryptToMasked(ssn_encrypted, env) : null;
      return { ...rest, ssn_masked };
    })
  );

  // 소유자 변경 이력 (지금은 빠진 사람 포함 전체, 시간순)
  const ownerHistory = await sql`
    SELECT oc.id, oc.name, oc.phone, po.created_at AS since, po.removed_at AS until
    FROM property_owners po
    JOIN clients oc ON oc.id = po.client_id
    WHERE po.property_id = ${id}
    ORDER BY po.created_at ASC
  `;

  let final_seller_ssn_masked = null;
  if (row.final_seller_client_id) {
    const [fc] = await sql`SELECT ssn_encrypted FROM clients WHERE id = ${row.final_seller_client_id}`;
    final_seller_ssn_masked = fc?.ssn_encrypted ? await decryptToMasked(fc.ssn_encrypted, env) : null;
  }

  return new Response(JSON.stringify({ ...row, final_seller_ssn_masked, owners: ownersSafe, owner_history: ownerHistory }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT({ request, params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const body = await request.json();

  // 물건 자체(단지명/동/호수/평형/주소 등)는 "물건" 탭에서만 수정합니다.
  // 매물 수정에서는 거래 관련 정보(희망가/거래유형/소유자/특장점 등)만 다룹니다.
  const {
    features, memo,
    transaction_type, asking_price, asking_deposit, asking_monthly_rent,
    owner_client_ids, primary_owner_client_id, partner_agency_id,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const ownerIds = Array.isArray(owner_client_ids) ? owner_client_ids.map(toInt).filter((v) => v !== null) : [];
  const primaryId = toInt(primary_owner_client_id) ?? (ownerIds.length > 0 ? ownerIds[0] : null);

  // 현재 활성 소유자와 비교해서 "실제로 소유자를 바꾸려는 건지" 먼저 확인
  const currentActive = await sql`
    SELECT client_id FROM property_owners WHERE property_id = ${id} AND removed_at IS NULL
  `;
  const currentActiveIds = currentActive.map((r) => r.client_id);
  const sortedCurrent = [...currentActiveIds].sort((a, b) => a - b);
  const sortedNext = [...ownerIds].sort((a, b) => a - b);
  const ownerSetChanged =
    sortedCurrent.length !== sortedNext.length || sortedCurrent.some((v, i) => v !== sortedNext[i]);

  if (ownerSetChanged) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM contracts
      WHERE property_id = ${id} AND is_deleted = FALSE
        AND (balance_date IS NULL OR balance_date >= now())
    `;
    if (count > 0) {
      return new Response(
        JSON.stringify({ error: `이 매물에 진행 중인 계약이 ${count}건 있어 소유자를 변경할 수 없습니다. 계약이 완료되거나 삭제된 후 다시 시도해주세요.` }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const [row] = await sql`
    UPDATE properties SET
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

  // 소유자 목록 갱신: 지우지 않고 "제외(removed_at)" 처리해서 이력을 남김. 다시 추가되면 재활성화.
  // (currentActiveIds는 위에서 이미 조회함)
  const toRemove = currentActiveIds.filter((cid) => !ownerIds.includes(cid));
  for (const cid of toRemove) {
    await sql`
      UPDATE property_owners SET removed_at = now()
      WHERE property_id = ${id} AND client_id = ${cid} AND removed_at IS NULL
    `;
  }

  const toAdd = ownerIds.filter((cid) => !currentActiveIds.includes(cid));
  for (const cid of toAdd) {
    await sql`
      INSERT INTO property_owners (property_id, client_id, is_primary)
      VALUES (${id}, ${cid}, ${cid === primaryId})
      ON CONFLICT (property_id, client_id) DO UPDATE SET removed_at = NULL, is_primary = ${cid === primaryId}
    `;
  }

  // 계속 유지되는 소유자들의 대표(주 계약자) 표시도 최신 지정대로 갱신
  if (ownerIds.length > 0) {
    await sql`
      UPDATE property_owners SET is_primary = (client_id = ${primaryId})
      WHERE property_id = ${id} AND removed_at IS NULL
    `;
  }

  return new Response(JSON.stringify({ ...row, owner_client_ids: ownerIds }), {
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