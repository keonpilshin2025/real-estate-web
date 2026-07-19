import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/contracts/check?property_id=1&contract_type=매매&exclude_id=5
//
// 이 매물에 이미 진행중인(잔금일 미도래 또는 미정) 계약들을 모두 가져와서
// 신규 계약유형과의 조합에 따라 blockingRows / warningRows로 분류해서 반환한다.
//
// 규칙:
// - 매매 + 매매          -> 차단 (blocking)
// - 전세/월세 + 전세/월세  -> 차단 (blocking)  (한 집에 세입자가 동시에 둘일 수 없음)
// - 매매 + 전세/월세       -> 경고 (warning)   (매매 후 임대, 또는 임대 낀 매매는 정상 흐름일 수 있으나 확인 필요)
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const propertyId = Number(url.searchParams.get("property_id"));
  const contractType = url.searchParams.get("contract_type") || "";
  const excludeIdParam = url.searchParams.get("exclude_id");
  const excludeId = excludeIdParam ? Number(excludeIdParam) : null;

  if (!propertyId || !contractType) {
    return new Response(JSON.stringify({ blockingRows: [], warningRows: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = await sql`
    SELECT c.id, c.contract_type, c.client_role, c.balance_date, cl.name AS client_name, cl.phone AS client_phone
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.property_id = ${propertyId}
      AND c.is_deleted = FALSE
      AND (c.balance_date IS NULL OR c.balance_date >= now())
      AND (${excludeId}::int IS NULL OR c.id != ${excludeId})
  `;

  const isLease = (t) => t === "전세" || t === "월세";

  const blockingRows = [];
  const warningRows = [];

  for (const row of rows) {
    const existingType = row.contract_type;

    if (contractType === "매매" && existingType === "매매") {
      blockingRows.push(row);
    } else if (isLease(contractType) && isLease(existingType)) {
      blockingRows.push(row);
    } else if (
      (contractType === "매매" && isLease(existingType)) ||
      (isLease(contractType) && existingType === "매매")
    ) {
      warningRows.push(row);
    }
  }

  return new Response(JSON.stringify({ blockingRows, warningRows }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}