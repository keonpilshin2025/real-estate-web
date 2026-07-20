import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function GET({ params }) {
  const sql = getDb(env.DATABASE_URL);
  const id = Number(params.id);
  const [row] = await sql`SELECT * FROM properties WHERE id = ${id}`;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
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
    property_name, property_type, dong, ho, address,
    unit_type, usage_type, features, memo,
    transaction_type, asking_price, asking_deposit, asking_monthly_rent,
    owner_name, owner_phone,
  } = body;

  const toInt = (v) => (v === null || v === undefined || v === "" ? null : Math.round(Number(v)));

  const [row] = await sql`
    UPDATE properties SET
      property_name = ${property_name},
      property_type = ${property_type},
      dong = ${dong || null},
      ho = ${ho || null},
      address = ${address || null},
      unit_type = ${unit_type || null},
      usage_type = ${usage_type || null},
      features = ${features || null},
      memo = ${memo || null},
      transaction_type = ${transaction_type || null},
      asking_price = ${toInt(asking_price)},
      asking_deposit = ${toInt(asking_deposit)},
      asking_monthly_rent = ${toInt(asking_monthly_rent)},
      owner_name = ${owner_name || null},
      owner_phone = ${owner_phone || null},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!row) {
    return new Response(JSON.stringify({ error: "해당 매물을 찾을 수 없습니다." }), { status: 404 });
  }

  return new Response(JSON.stringify(row), {
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