export const prerender = false;

import { env } from "cloudflare:workers";

export async function POST({ request }) {
  try {
    const { propertyType, complex, dealType, budgetMain, budgetRent, situations, name, phone, memo } = await request.json();

    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "phone required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!propertyType || typeof propertyType !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "propertyType required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatIds = env.TELEGRAM_CHAT_IDS.split(",").map((id) => id.trim());

    const situationsText =
      Array.isArray(situations) && situations.length > 0 ? situations.map((s) => `· ${s}`).join("\n") : "미선택";

    let budgetText = "미선택";
    if (dealType === "매매" && budgetMain) budgetText = `${budgetMain}`;
    else if (dealType === "전세" && budgetMain) budgetText = `보증금 ${budgetMain}`;
    else if (dealType === "월세" && (budgetMain || budgetRent)) {
      budgetText = `보증금 ${budgetMain || "미선택"} / 월세 ${budgetRent || "미선택"}`;
    }

    const text =
      `🏠 새 물건 상담 신청\n` +
      `관심매물: ${propertyType}${complex && String(complex).trim() ? ` (${String(complex).trim()})` : ""}\n` +
      `거래유형: ${dealType || "미선택"}\n` +
      `예산: ${budgetText}\n` +
      `지금 상황:\n${situationsText}\n` +
      `이름: ${name && String(name).trim() ? String(name).trim() : "미입력"}\n` +
      `연락처: ${phone}` +
      (memo && String(memo).trim() ? `\n하고 싶은 말: ${String(memo).trim()}` : "");

    const results = await Promise.all(
      chatIds.map(async (chatId) => {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        });
        const body = await res.text();
        return { chatId, ok: res.ok, status: res.status, body };
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.error("텔레그램 전송 실패:", JSON.stringify(failed));
      return new Response(
        JSON.stringify({ ok: false, error: "텔레그램 전송 실패", detail: failed }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}