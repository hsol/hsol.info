/**
 * 세션 쿠키 서명/검증 자체 점검. 프레임워크 없이 tsx 로 직접 실행:
 *   npx tsx src/lib/manage-auth.check.ts
 */
import assert from "node:assert";

import { SESSION_TTL_SEC, signSession, verifySession, type ManageSession } from "./manage-auth";

const SECRET = "test-secret-0123456789abcdef0123456789";

async function main() {
  const now = Math.floor(Date.now() / 1000);
  const session: ManageSession = { sub: "u_123", email: "a@b.com", name: "한글 이름", exp: now + SESSION_TTL_SEC };

  const token = await signSession(session, SECRET);

  const ok = await verifySession(token, SECRET);
  assert(ok, "round-trip: verify returned null");
  assert(ok.sub === "u_123" && ok.email === "a@b.com" && ok.name === "한글 이름", "round-trip: payload mismatch");

  assert((await verifySession(token, "wrong-secret")) === null, "wrong secret was accepted");

  const [body, sig] = token.split(".");
  const flipped = (body.endsWith("AA") ? body.slice(0, -2) + "BB" : body.slice(0, -2) + "AA") + "." + sig;
  assert((await verifySession(flipped, SECRET)) === null, "tampered payload was accepted");

  const expired = await signSession({ ...session, exp: now - 10 }, SECRET);
  assert((await verifySession(expired, SECRET)) === null, "expired token was accepted");

  console.log("✓ manage-auth self-check passed");
}

main().catch((err) => {
  console.error("✗ manage-auth self-check FAILED");
  console.error(err);
  process.exit(1);
});
