import { env } from "cloudflare:workers";
import { verifySessionToken, sha256Hex } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function POST({ request }) {
  // 로그인 세션 확인 (미들웨어 보호 대상이 아니라 여기서 직접 확인)
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/admin_session=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  const session = await verifySessionToken(env.SESSION_SECRET, token);

  if (!session) {
    return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: "현재 비밀번호와 새 비밀번호를 모두 입력하세요." }), { status: 400 });
  }
  if (newPassword.length < 4) {
    return new Response(JSON.stringify({ error: "새 비밀번호는 4자 이상이어야 합니다." }), { status: 400 });
  }

  const sql = getDb(env.DATABASE_URL);
  const [user] = await sql`SELECT * FROM admin_users WHERE username = ${session.u}`;

  if (!user) {
    return new Response(JSON.stringify({ error: "계정을 찾을 수 없습니다." }), { status: 404 });
  }

  const currentHash = await sha256Hex(currentPassword);
  if (currentHash !== user.password_hash) {
    return new Response(JSON.stringify({ error: "현재 비밀번호가 일치하지 않습니다." }), { status: 401 });
  }

  const newHash = await sha256Hex(newPassword);
  await sql`UPDATE admin_users SET password_hash = ${newHash}, updated_at = now() WHERE username = ${session.u}`;

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}