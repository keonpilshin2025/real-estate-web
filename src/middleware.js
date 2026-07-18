import { env } from "cloudflare:workers";
import { verifySessionToken, createSessionToken } from "./lib/auth.js";

export async function onRequest({ request, locals, redirect }, next) {
  const url = new URL(request.url);

  // /admin 하위 경로만 보호 (로그인 페이지 자체는 제외)
  const isAdminPath = url.pathname.startsWith("/admin") && url.pathname !== "/admin/login";
  const isProtectedApi = url.pathname.startsWith("/api/clients") || url.pathname.startsWith("/api/properties") || url.pathname.startsWith("/api/contracts");

  if (isAdminPath || isProtectedApi) {
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(/admin_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1]) : null;

    const session = await verifySessionToken(env.SESSION_SECRET, token);

    if (!session) {
      if (isProtectedApi) {
        return new Response(JSON.stringify({ error: "세션이 만료되었습니다. 다시 로그인해 주세요." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return redirect("/admin/login");
    }

    locals.admin = { username: session.u };

    // 활동이 있을 때마다 세션을 30분 다시 연장 (idle timeout 방식)
    const response = await next();
    const isHttps = url.protocol === "https:";
    const secureFlag = isHttps ? " Secure;" : "";
    const newToken = await createSessionToken(env.SESSION_SECRET, session.u);

    const refreshed = new Response(response.body, response);
    refreshed.headers.append(
      "Set-Cookie",
      `admin_session=${encodeURIComponent(newToken)}; Path=/; HttpOnly;${secureFlag} SameSite=Lax; Max-Age=${60 * 30}`
    );
    return refreshed;
  }

  return next();
}