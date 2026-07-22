import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/contracts  -> 물건명/고객명/물건지부동산/매도자(임대인) 조인해서 리스트로 반환
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";

  const rows = await sql`
    SELECT
      c.*,
      p.property_name, p.dong AS property_dong, p.ho AS property_ho, p.unit_type AS property_unit_type,
      p.owner_name AS property_owner_name, p.owner_phone AS property_owner_phone,
      COALESCE(
        (
          SELECT json_agg(json_build_object('id', oc.id, 'name', oc.name, 'phone', oc.phone, 'is_primary', po.is_primary) ORDER BY po.is_primary DESC, po.id)
          FROM property_owners po
          JOIN clients oc ON oc.id = po.client_id
          WHERE po.property_id = p.id
        ),
        '[]'
      ) AS property_owners,
      cl.name AS client_name, cl.phone AS client_phone,
      pa.agency_name AS partner_agency_name
    FROM contracts c
    JOIN properties p ON p.id = c.property_id
    JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN partner_agencies pa ON pa.id = c.partner_agency_id
    WHERE c.is_deleted = FALSE
      AND (${q} = '' OR p.property_name ILIKE ${'%' + q + '%'} OR cl.name ILIKE ${'%' + q + '%'})
    ORDER BY c.created_at DESC
  `;

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// POST /api/contracts  (물건-고객 매핑 등록)
export async function POST({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const body = await request.json();

  const {
    property_id, client_id, client_role, contract_type,
    price, deposit, monthly_rent, down_payment, balance_amount,
    contract_date, balance_date, move_in_date, memo,
    partner_agency_id, deal_status,
  } = body;

  if (!property_id || !client_id || !client_role || !contract_type) {
    return new Response(
      JSON.stringify({ error: "물건, 고객, 구분(매도/매수 등), 계약유형은 필수입니다." }),
      { status: 400 }
    );
  }

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));
  const partnerAgencyIdInt = toInt(partner_agency_id);
  const brokerageType = partnerAgencyIdInt ? "공동" : "단독";
  const status = deal_status || "진행";

  // 매도(임대)인 주소 스냅샷: 이 계약의 고객이 매도/임대 역할이면 그 고객 주소를,
  // 아니면(고객이 매수/임차 역할이면) 매물에 연동된 소유자(공동명의 시 첫 번째 등록된 소유자)의 주소를 사용
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

  // 매수(임차)인 주소 스냅샷: 이 계약의 고객이 매수/임차 역할일 때만 그 고객 주소를 고정
  const isBuyer = client_role === "매수인" || client_role === "임차인";
  let buyerAddressSnapshot = null;
  if (isBuyer) {
    const [c] = await sql`SELECT address FROM clients WHERE id = ${client_id}`;
    buyerAddressSnapshot = c?.address || null;
  }

  try {
    const [row] = await sql`
      INSERT INTO contracts
        (property_id, client_id, client_role, contract_type,
         price, deposit, monthly_rent, down_payment, balance_amount,
         contract_date, balance_date, move_in_date, memo,
         partner_agency_id, brokerage_type, deal_status, seller_address_snapshot, buyer_address_snapshot)
      VALUES
        (${property_id}, ${client_id}, ${client_role}, ${contract_type},
         ${toInt(price)}, ${toInt(deposit)}, ${toInt(monthly_rent)}, ${toInt(down_payment)}, ${toInt(balance_amount)},
         ${contract_date || null}, ${balance_date || null}, ${move_in_date || null}, ${memo || null},
         ${partnerAgencyIdInt}, ${brokerageType}, ${status}, ${sellerAddressSnapshot}, ${buyerAddressSnapshot})
      RETURNING *
    `;

    return new Response(JSON.stringify(row), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = String(e?.message || e);
    if (e?.code === "23505" || msg.includes("duplicate key") || msg.includes("uniq_contracts_property_client_active")) {
      return new Response(
        JSON.stringify({ error: "이미 등록된 물건-고객 조합입니다. 기존 계약을 삭제한 후 다시 등록해 주세요." }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }
    throw e;
  }
}