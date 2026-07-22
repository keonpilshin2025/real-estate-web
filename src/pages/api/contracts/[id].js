import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`
    SELECT
      c.*,
      p.property_name, p.dong AS property_dong, p.ho AS property_ho,
      cl.name AS client_name, cl.phone AS client_phone,
      pa.agency_name AS partner_agency_name
    FROM contracts c
    JOIN properties p ON p.id = c.property_id
    JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN partner_agencies pa ON pa.id = c.partner_agency_id
    WHERE c.id = ${id}
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 계약을 찾을 수 없습니다." }), { status: 404 });
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
    property_id, client_id, client_role, contract_type,
    price, deposit, monthly_rent, down_payment, balance_amount,
    contract_date, balance_date, move_in_date, memo,
    partner_agency_id, deal_status,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const partnerAgencyIdInt = toInt(partner_agency_id);
  const brokerageType = partnerAgencyIdInt ? "공동" : "단독";

  // 매도(임대)인 주소 스냅샷 재계산 (수정 시점 기준으로 다시 고정)
  const isSeller = client_role === "매도인" || client_role === "임대인";
  let sellerAddressSnapshot = null;
  if (isSeller) {
    const [c] = await sql`SELECT address FROM clients WHERE id = ${client_id}`;
    sellerAddressSnapshot = c?.address || null;
  } else {
    const [p] = await sql`
      SELECT oc.address FROM property_owners po
      JOIN clients oc ON oc.id = po.client_id
      WHERE po.property_id = ${property_id}
      ORDER BY po.id
      LIMIT 1
    `;
    sellerAddressSnapshot = p?.address || null;
  }

  // 매수(임차)인 주소 스냅샷 재계산
  const isBuyer = client_role === "매수인" || client_role === "임차인";
  let buyerAddressSnapshot = null;
  if (isBuyer) {
    const [c] = await sql`SELECT address FROM clients WHERE id = ${client_id}`;
    buyerAddressSnapshot = c?.address || null;
  }

  try {
    const [row] = await sql`
      UPDATE contracts SET
        property_id = ${property_id},
        client_id = ${client_id},
        client_role = ${client_role},
        contract_type = ${contract_type},
        price = ${toInt(price)},
        deposit = ${toInt(deposit)},
        monthly_rent = ${toInt(monthly_rent)},
        down_payment = ${toInt(down_payment)},
        balance_amount = ${toInt(balance_amount)},
        contract_date = ${contract_date || null},
        balance_date = ${balance_date || null},
        move_in_date = ${move_in_date || null},
        memo = ${memo || null},
        partner_agency_id = ${partnerAgencyIdInt},
        brokerage_type = ${brokerageType},
        deal_status = ${deal_status || "진행"},
        seller_address_snapshot = ${sellerAddressSnapshot},
        buyer_address_snapshot = ${buyerAddressSnapshot},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!row) {
      return new Response(JSON.stringify({ error: "해당 계약을 찾을 수 없습니다." }), { status: 404 });
    }

    return new Response(JSON.stringify(row), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (e?.code === "23505" || msg.includes("duplicate key") || msg.includes("uniq_contracts_property_client_active")) {
      return new Response(
        JSON.stringify({ error: "이미 등록된 물건-고객 조합입니다." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }
}

// 소프트 삭제: 실제 row는 유지하고 플래그만 처리 (같은 물건-고객 조합 재등록 가능해짐)
export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  await sql`UPDATE contracts SET is_deleted = TRUE, deleted_at = now() WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}