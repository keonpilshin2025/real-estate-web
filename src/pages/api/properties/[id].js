import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";
import { decryptToMasked } from "../../../lib/crypto.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);

  const [row] = await sql`
    SELECT
      p.*,
      pa.agency_name AS partner_agency_name,
      oc.name AS owner_client_name,
      oc.phone AS owner_client_phone,
      oc.ssn_encrypted AS owner_client_ssn_encrypted,
      c.id AS active_contract_id,
      c.contract_type AS final_contract_type,
      c.price AS final_price,
      c.deposit AS final_deposit,
      c.monthly_rent AS final_monthly_rent,
      c.balance_date AS final_balance_date
    FROM properties p
    LEFT JOIN partner_agencies pa ON pa.id = p.partner_agency_id
    LEFT JOIN clients oc ON oc.id = p.owner_client_id
    LEFT JOIN LATERAL (
      SELECT * FROM contracts c2
      WHERE c2.property_id = p.id
        AND c2.is_deleted = FALSE
        AND (c2.balance_date IS NULL OR c2.balance_date >= now())
      ORDER BY c2.created_at DESC
      LIMIT 1
    ) c ON true
    WHERE p.id = ${id}
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }

  const { owner_ssn_encrypted, owner_client_ssn_encrypted, ...rest } = row;
  const owner_ssn_masked = owner_ssn_encrypted ? await decryptToMasked(owner_ssn_encrypted, env) : null;
  const owner_client_ssn_masked = owner_client_ssn_encrypted ? await decryptToMasked(owner_client_ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, owner_ssn_masked, owner_client_ssn_masked }), {
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
    owner_client_id, partner_agency_id,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));

  const [row] = await sql`
    UPDATE properties SET
      property_name = ${property_name}, property_type = ${property_type},
      dong = ${dong || null}, ho = ${ho || null}, address = ${address || null},
      unit_type = ${unit_type || null}, usage_type = ${usage_type || null},
      features = ${features || null}, memo = ${memo || null},
      transaction_type = ${transaction_type || null},
      asking_price = ${toInt(asking_price)}, asking_deposit = ${toInt(asking_deposit)},
      asking_monthly_rent = ${toInt(asking_monthly_rent)},
      owner_client_id = ${toInt(owner_client_id)},
      partner_agency_id = ${toInt(partner_agency_id)},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }

  const { owner_ssn_encrypted, ...rest } = row;
  const owner_ssn_masked = owner_ssn_encrypted ? await decryptToMasked(owner_ssn_encrypted, env) : null;

  return new Response(JSON.stringify({ ...rest, owner_ssn_masked }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  await sql`DELETE FROM properties WHERE id = ${id}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}