export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { complex, budget, phone, memo } = await request.json();

    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "phone required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatIds = env.TELEGRAM_CHAT_IDS.split(",").map((id) => id.trim());

    const text =
      `📩 새 매물 상담 신청\n` +
      `단지: ${complex || "미선택"}\n` +
      `예산: ${budget || "미선택"}\n` +
      `연락처: ${phone}` +
      (memo && String(memo).trim() ? `\n상담 내용: ${String(memo).trim()}` : "");

    const results = await Promise.all(
      chatIds.map((chatId) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text }),
        })
      )
    );

    if (results.some((r) => !r.ok)) {
      console.error("일부 텔레그램 전송 실패");
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
};