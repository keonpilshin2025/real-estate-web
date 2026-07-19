export const prerender = false;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { name, phone, date, timeSlot, memo } = await request.json();

    if (!phone || typeof phone !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "phone required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = env.TELEGRAM_BOT_TOKEN;
    const chatIds = env.TELEGRAM_CHAT_IDS.split(",").map((id) => id.trim());

    const text =
      `🏠 방문 예약 신청\n` +
      `이름: ${name && String(name).trim() ? String(name).trim() : "미입력"}\n` +
      `연락처: ${phone}\n` +
      `희망일: ${date || "미입력"}\n` +
      `희망 시간대: ${timeSlot || "미입력"}` +
      (memo && String(memo).trim() ? `\n남기신 말씀: ${String(memo).trim()}` : "");

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