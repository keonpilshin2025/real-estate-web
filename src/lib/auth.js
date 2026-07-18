// HMAC 서명 기반 세션 토큰. Cloudflare Workers 런타임(Web Crypto)에서 동작합니다.

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// 로그인 성공 시 세션 토큰 발급 (기본 30분 유효 — 활동이 있으면 미들웨어가 자동 연장)
export async function createSessionToken(secret, username, ttlSeconds = 60 * 30) {
  const payload = { u: username, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(sig)}`;
}

// 요청에 담긴 세션 토큰 검증. 유효하면 { u, exp } 반환, 아니면 null
export async function verifySessionToken(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sigB64),
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; // 만료
    return payload;
  } catch {
    return null;
  }
}

// 비밀번호 해시 (SHA-256 + 고정 salt). ADMIN_PASSWORD_HASH 값 생성/검증에 사용.
export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}