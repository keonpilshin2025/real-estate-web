import { env } from "cloudflare:workers";

export const prerender = false;

const BASE_URL = "https://apis.data.go.kr/1613000/BldRgstHubService";

// 지번 주소 문자열에서 번/지를 뽑아 4자리로 맞춤 (예: "600-1" -> bun=0600, ji=0001 / "600" -> bun=0600, ji=0000)
function parseBunJi(jibunAddress) {
  if (!jibunAddress) return { bun: "", ji: "" };
  const lastToken = jibunAddress.trim().split(/\s+/).pop() || "";
  const [bunRaw, jiRaw] = lastToken.split("-");
  const bun = (bunRaw || "").replace(/\D/g, "").padStart(4, "0");
  const ji = (jiRaw || "0").replace(/\D/g, "").padStart(4, "0");
  return { bun, ji };
}

async function callApi(operation, params) {
  if (!env.BUILDING_LEDGER_API_KEY) {
    throw new Error("BUILDING_LEDGER_API_KEY가 설정되어 있지 않습니다.");
  }

  const allItems = [];
  let pageNo = 1;
  const numOfRows = 500;
  let totalCount = null;

  while (true) {
    const url = new URL(`${BASE_URL}/${operation}`);
    url.searchParams.set("serviceKey", env.BUILDING_LEDGER_API_KEY);
    url.searchParams.set("_type", "json");
    url.searchParams.set("numOfRows", String(numOfRows));
    url.searchParams.set("pageNo", String(pageNo));
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
    const debugParams = JSON.stringify(params);

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
      },
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // 정부 API는 인증키 오류 등이 있으면 JSON 대신 XML 에러를 돌려주는 경우가 많음. 최대한 원인을 뽑아서 보여줌.
      const xmlMsg =
        text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>/)?.[1] ||
        text.match(/<errMsg>(.*?)<\/errMsg>/)?.[1] ||
        text.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1] ||
        text.match(/<title>(.*?)<\/title>/)?.[1];
      if (xmlMsg) {
        throw new Error(`건축물대장 API 오류(${operation}): ${xmlMsg} (HTTP ${res.status}, 요청값: ${debugParams})`);
      }
      throw new Error(
        text
          ? `건축물대장 API 응답을 해석하지 못했습니다(${operation}, HTTP ${res.status} ${res.statusText}, 요청값: ${debugParams}): ${text.slice(0, 300)}`
          : `건축물대장 API가 빈 응답을 반환했습니다(${operation}, HTTP ${res.status} ${res.statusText}, 요청값: ${debugParams}).`
      );
    }
    const header = json?.response?.header;
    if (header && header.resultCode !== "00") {
      throw new Error(`건축물대장 API 오류: ${header.resultMsg || header.resultCode}`);
    }

    const body = json?.response?.body;
    const items = body?.items?.item;
    const pageItems = items ? (Array.isArray(items) ? items : [items]) : [];
    allItems.push(...pageItems);

    totalCount = Number(body?.totalCount || 0);

    // 더 가져올 게 없으면 종료 (마지막 페이지거나, 이번 페이지에 아무것도 없거나)
    if (pageItems.length === 0 || allItems.length >= totalCount || pageNo > 20) break;
    pageNo += 1;
  }

  return allItems;
}

// GET /api/building-lookup?bcode=법정동코드10자리&jibun=지번주소텍스트
export async function GET({ request }) {
  const url = new URL(request.url);
  const bcode = url.searchParams.get("bcode") || "";
  const jibun = url.searchParams.get("jibun") || "";
  const dongQuery = (url.searchParams.get("dong") || "").trim();

  if (!bcode || bcode.length !== 10) {
    return new Response(JSON.stringify({ error: "법정동코드(bcode)가 올바르지 않습니다. 주소를 다시 검색해주세요." }), { status: 400 });
  }

  const sigunguCd = bcode.slice(0, 5);
  const bjdongCd = bcode.slice(5, 10);
  const { bun, ji } = parseBunJi(jibun);

  // 동 검색어가 있으면 "807" -> "807동"처럼 맞춰서 서버(정부 API)에 바로 필터 요청 (전체를 안 받아오니 훨씬 빠름)
  const dongNm = dongQuery ? (/^\d+$/.test(dongQuery) ? `${dongQuery}동` : dongQuery) : "";

  try {
    // 표제부: 건물 전체의 주용도, 건물명 (동 필터 없이 소량만 조회)
    const titleItems = await callApi("getBrTitleInfo", { sigunguCd, bjdongCd, bun, ji });
    // 전유부: 개별 동/호수별 정보. 동을 입력했으면 그 동만 서버에서 걸러서 가져옴
    const exposItems = await callApi("getBrExposPubuseAreaInfo", { sigunguCd, bjdongCd, bun, ji, dongNm });

    const mainPurps = titleItems[0]?.mainPurpsCdNm || titleItems[0]?.etcPurps || "";
    const bldNm = titleItems[0]?.bldNm || "";

    // 동/호수별로 정리 (전유 면적 위주로, 중복 제거)
    const seen = new Set();
    const units = [];
    for (const it of exposItems) {
      const dongNmItem = it.dongNm || "";
      const hoNm = it.hoNm || "";
      const area = it.area ? Number(it.area) : null;
      const key = `${dongNmItem}__${hoNm}`;
      if (seen.has(key) || (!dongNmItem && !hoNm)) continue;
      seen.add(key);
      units.push({ dong: dongNmItem, ho: hoNm, sqm: area });
    }

    return new Response(JSON.stringify({ bldNm, mainPurps, units }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "건축물대장 조회에 실패했습니다." }), { status: 502 });
  }
}