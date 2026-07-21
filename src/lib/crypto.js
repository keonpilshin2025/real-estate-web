// 주민번호 등 민감정보 암호화 유틸.
// Cloudflare Secret으로 등록한 SSN_ENCRYPTION_KEY(32바이트를 base64로 인코딩한 문자열)를 사용합니다.
//
// 키 생성 방법 (터미널에서 한 번 실행):
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// 생성된 값을 아래처럼 등록하세요:
//   npx wrangler secret put SSN_ENCRYPTION_KEY   (배포용)
//   .dev.vars 파일에 SSN_ENCRYPTION_KEY=발급받은값 추가  (로컬 개발용)

async function getKey(env) {
  const rawKey = env.SSN_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error("SSN_ENCRYPTION_KEY가 설정되어 있지 않습니다. Cloudflare Secret을 등록해주세요.");
  }
  const keyBytes = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// 평문 문자열을 암호화해서 base64 문자열로 반환 (앞 12바이트는 IV)
export async function encryptText(plainText, env) {
  if (!plainText) return null;
  const key = await getKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const cipherBytes = new Uint8Array(cipherBuf);
  const combined = new Uint8Array(iv.length + cipherBytes.length);
  combined.set(iv, 0);
  combined.set(cipherBytes, iv.length);
  return bytesToBase64(combined);
}

// encryptText로 암호화된 base64 문자열을 복호화
export async function decryptText(encryptedB64, env) {
  if (!encryptedB64) return null;
  const key = await getKey(env);
  const combined = base64ToBytes(encryptedB64);
  const iv = combined.slice(0, 12);
  const cipherBytes = combined.slice(12);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  return new TextDecoder().decode(plainBuf);
}

// 주민번호 마스킹: 앞 6자리(생년월일) + 뒤 첫 1자리만 보이고 나머지는 * 처리
// 예: 990101-1234567 -> 990101-1******
export function maskSsn(plainText) {
  if (!plainText) return null;
  const digits = String(plainText).replace(/\D/g, "");
  if (digits.length < 7) return plainText;
  const front = digits.slice(0, 6);
  const backFirst = digits.slice(6, 7);
  return `${front}-${backFirst}******`;
}

// 암호화된 값을 바로 마스킹된 형태로 변환 (목록/엑셀용 — 평문은 응답에 절대 포함하지 않음)
export async function decryptToMasked(encryptedB64, env) {
  if (!encryptedB64) return null;
  try {
    const plain = await decryptText(encryptedB64, env);
    return maskSsn(plain);
  } catch (e) {
    return null;
  }
}