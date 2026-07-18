// 사용법: node generate-hash.mjs "내가 쓸 비밀번호"
// 출력된 값을 .dev.vars / Cloudflare 환경변수의 ADMIN_PASSWORD_HASH 에 넣으세요.

import crypto from "crypto";

const password = process.argv[2];
if (!password) {
  console.error('사용법: node generate-hash.mjs "비밀번호"');
  process.exit(1);
}

const hash = crypto.createHash("sha256").update(password, "utf8").digest("hex");
console.log("ADMIN_PASSWORD_HASH=" + hash);
