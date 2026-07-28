import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

// GET /api/stats?view=overview|by-complex|trend|deal-type|by-unit-type|price-trend|by-dong|by-floor
export async function GET({ request }) {
  const sql = getDb(env.DATABASE_URL);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "overview";
  const period = url.searchParams.get("period") === "week" ? "week" : "month"; // price-trend 전용

  try {
    // 시세 분석 - 단지별 시세
    if (view === "by-complex") {
      const rows = await sql`
        SELECT
          u.property_name,
          COUNT(*) AS deal_count,
          ROUND(AVG(c.price)) AS avg_price,
          MIN(c.price) AS min_price,
          MAX(c.price) AS max_price
        FROM contracts c
        JOIN properties p ON p.id = c.property_id
        JOIN real_estate_units u ON u.id = p.unit_id
        WHERE c.contract_type = '매매' AND c.is_deleted = FALSE
          AND (c.deal_status = '완료' OR c.balance_date <= now())
        GROUP BY u.property_name
        ORDER BY avg_price DESC
      `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 사업 현황 - 기간별(월별) 거래건수/매출 추이 (최근 6개월)
    if (view === "trend") {
      const rows = await sql`
        SELECT
          to_char(date_trunc('month', balance_date), 'YYYY-MM') AS period,
          COUNT(*) AS deal_count,
          SUM(CASE WHEN contract_type = '매매' THEN price ELSE 0 END) AS total_sale_amount
        FROM contracts
        WHERE is_deleted = FALSE
          AND balance_date >= date_trunc('month', now()) - interval '5 months'
          AND (deal_status = '완료' OR balance_date <= now())
        GROUP BY period
        ORDER BY period
      `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 사업 현황 - 거래유형/중개유형 비중
    if (view === "deal-type") {
      const byType = await sql`
        SELECT contract_type, COUNT(*) AS cnt
        FROM contracts
        WHERE is_deleted = FALSE AND (deal_status = '완료' OR balance_date <= now())
        GROUP BY contract_type
        ORDER BY cnt DESC
      `;
      const byBrokerage = await sql`
        SELECT COALESCE(brokerage_type, '단독') AS brokerage_type, COUNT(*) AS cnt
        FROM contracts
        WHERE is_deleted = FALSE AND (deal_status = '완료' OR balance_date <= now())
        GROUP BY COALESCE(brokerage_type, '단독')
        ORDER BY cnt DESC
      `;
      return new Response(JSON.stringify({ byType, byBrokerage }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 시세 분석 - 평형별 시세
    if (view === "by-unit-type") {
      const rows = await sql`
        SELECT
          u.unit_type,
          COUNT(*) AS deal_count,
          ROUND(AVG(c.price)) AS avg_price
        FROM contracts c
        JOIN properties p ON p.id = c.property_id
        JOIN real_estate_units u ON u.id = p.unit_id
        WHERE c.contract_type = '매매' AND c.is_deleted = FALSE
          AND (c.deal_status = '완료' OR c.balance_date <= now())
          AND u.unit_type IS NOT NULL
        GROUP BY u.unit_type
        ORDER BY avg_price ASC
      `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 시세 분석 - 주별/월별 가격 동향 (매매 평균가 추이)
    if (view === "price-trend") {
      const rows =
        period === "week"
          ? await sql`
              SELECT
                to_char(date_trunc('week', balance_date), 'MM/DD') AS period,
                COUNT(*) AS deal_count,
                ROUND(AVG(price)) AS avg_price
              FROM contracts
              WHERE contract_type = '매매' AND is_deleted = FALSE
                AND (deal_status = '완료' OR balance_date <= now())
                AND balance_date >= now() - interval '12 weeks'
              GROUP BY date_trunc('week', balance_date)
              ORDER BY date_trunc('week', balance_date)
            `
          : await sql`
              SELECT
                to_char(date_trunc('month', balance_date), 'YYYY-MM') AS period,
                COUNT(*) AS deal_count,
                ROUND(AVG(price)) AS avg_price
              FROM contracts
              WHERE contract_type = '매매' AND is_deleted = FALSE
                AND (deal_status = '완료' OR balance_date <= now())
                AND balance_date >= date_trunc('month', now()) - interval '11 months'
              GROUP BY date_trunc('month', balance_date)
              ORDER BY date_trunc('month', balance_date)
            `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 시세 분석 - 동별 시세 (같은 단지 안에서도 동마다 가격 다른 걸 반영)
    if (view === "by-dong") {
      const rows = await sql`
        SELECT
          u.property_name,
          u.dong,
          COUNT(*) AS deal_count,
          ROUND(AVG(c.price)) AS avg_price,
          MIN(c.price) AS min_price,
          MAX(c.price) AS max_price
        FROM contracts c
        JOIN properties p ON p.id = c.property_id
        JOIN real_estate_units u ON u.id = p.unit_id
        WHERE c.contract_type = '매매' AND c.is_deleted = FALSE
          AND (c.deal_status = '완료' OR c.balance_date <= now())
          AND u.dong IS NOT NULL
        GROUP BY u.property_name, u.dong
        ORDER BY u.property_name, u.dong
      `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 시세 분석 - 층대별 시세 (호수가 순수 숫자인 것만 - 3대장처럼 표준 넘버링일 때만 신뢰 가능)
    if (view === "by-floor") {
      const rows = await sql`
        WITH deals AS (
          SELECT
            c.price,
            FLOOR(NULLIF(regexp_replace(u.ho, '[^0-9]', '', 'g'), '')::int / 100) AS floor_num
          FROM contracts c
          JOIN properties p ON p.id = c.property_id
          JOIN real_estate_units u ON u.id = p.unit_id
          WHERE c.contract_type = '매매' AND c.is_deleted = FALSE
            AND (c.deal_status = '완료' OR c.balance_date <= now())
            AND u.ho ~ '^[0-9]+$'
        )
        SELECT
          CASE WHEN floor_num <= 3 THEN '저층(1~3층)' WHEN floor_num <= 10 THEN '중층(4~10층)' ELSE '고층(11층~)' END AS floor_band,
          COUNT(*) AS deal_count,
          ROUND(AVG(price)) AS avg_price,
          MIN(CASE WHEN floor_num <= 3 THEN 1 WHEN floor_num <= 10 THEN 2 ELSE 3 END) AS sort_key
        FROM deals
        GROUP BY floor_band
        ORDER BY sort_key
      `;
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 사업 현황 - 개요 (기본값)
    const [dealCountRow] = await sql`
      SELECT COUNT(*) AS cnt
      FROM contracts
      WHERE is_deleted = FALSE
        AND balance_date >= date_trunc('month', now())
        AND balance_date < date_trunc('month', now()) + interval '1 month'
    `;
    const [avgPriceRow] = await sql`
      SELECT ROUND(AVG(price)) AS avg_price
      FROM contracts
      WHERE contract_type = '매매' AND is_deleted = FALSE
        AND (deal_status = '완료' OR balance_date <= now())
    `;
    const [ongoingRow] = await sql`
      SELECT COUNT(*) AS cnt
      FROM contracts
      WHERE is_deleted = FALSE AND deal_status != '완료'
        AND (balance_date IS NULL OR balance_date > now())
    `;

    return new Response(
      JSON.stringify({
        deal_count_this_month: Number(dealCountRow?.cnt || 0),
        avg_price: avgPriceRow?.avg_price ? Number(avgPriceRow.avg_price) : null,
        ongoing_count: Number(ongoingRow?.cnt || 0),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("GET /api/stats failed:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}