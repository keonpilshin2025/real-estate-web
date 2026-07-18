import { env } from "cloudflare:workers";
import { createSessionToken, sha256Hex } from "../../../lib/auth.js";
import { getDb } from "../../../lib/db.js";

export const prerender = false;

export async function POST({ request }) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return new Response(JSON.stringify({ error: "아이디와 비밀번호를 입력하세요." }), { status: 400 });
  }

  const sql = getDb(env.DATABASE_URL);
  const [user] = await sql`SELECT * FROM admin_users WHERE username = ${username}`;

  if (!user) {
    return new Response(JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }), { status: 401 });
  }

  const inputHash = await sha256Hex(password);
  if (inputHash !== user.password_hash) {
    return new Response(JSON.stringify({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }), { status: 401 });
  }

  const token = await createSessionToken(env.SESSION_SECRET, username);

  const isHttps = new URL(request.url).protocol === "https:";
  const secureFlag = isHttps ? " Secure;" : "";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_session=${encodeURIComponent(
        token
      )}; Path=/; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=${60 * 30}`,
    },
  });
}