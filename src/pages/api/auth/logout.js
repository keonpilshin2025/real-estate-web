export const prerender = false;

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}
