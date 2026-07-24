import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/public/properties
// 홈페이지에 노출할 안전한 필드만 반환합니다.
// 소유자 이름/연락처/주민번호 등 개인정보는 절대 포함하지 않습니다.
// 매매로 완료(잔금 완료)된 매물은 더 이상 판매중이 아니므로 자동으로 제외됩니다.
export async function GET() {
  const sql = getDb(env.DATABASE_URL);

  const rows = await sql`
    SELECT
      p.id, u.property_name, u.property_type, u.dong, u.unit_type,
      p.transaction_type, p.asking_price, p.asking_deposit, p.asking_monthly_rent,
      p.features, u.address
    FROM properties p
    JOIN real_estate_units u ON u.id = p.unit_id
    WHERE NOT EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.property_id = p.id
        AND c.is_deleted = FALSE
        AND c.contract_type = '매매'
        AND (c.deal_status = '완료' OR (c.balance_date IS NOT NULL AND c.balance_date <= now()))
    )
    ORDER BY p.created_at DESC
    LIMIT 20
  `;

  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // 공개 데이터라 캐싱 가능 (5분)
      "Cache-Control": "public, max-age=300",
    },
  });
}