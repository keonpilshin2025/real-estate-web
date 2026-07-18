import { env } from "cloudflare:workers";
import { getDb } from "../../lib/db.js";

export const prerender = false;

// GET /api/complex-presets  -> 전체 프리셋 (단지명별로 그룹핑해서 반환)
export async function GET() {
  const sql = getDb(env.DATABASE_URL);
  const rows = await sql`SELECT * FROM complex_presets ORDER BY complex_name, dong`;

  // { "센트럴타운": { address, dongs: { "301동": { unit_types, ho_list }, ... } }, ... }
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.complex_name]) {
      grouped[r.complex_name] = { address: r.address, dongs: {} };
    }
    grouped[r.complex_name].dongs[r.dong] = {
      unit_types: r.unit_types,
      ho_list: r.ho_list,
    };
  }

  return new Response(JSON.stringify(grouped), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
