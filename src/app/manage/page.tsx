import { cookies } from "next/headers";

import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  // 미들웨어가 이미 세션을 보장하지만, 표시용으로 한 번 더 읽는다.
  const store = await cookies();
  const token = store.get(MANAGE_COOKIE)?.value;
  const session = token ? await verifySession(token, process.env.MANAGE_SESSION_SECRET as string) : null;
  const who = session?.name ? `${session.name} (${session.email})` : session?.email;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Console</p>
      <h1 className="mt-2 text-3xl font-semibold">관리 콘솔</h1>
      <p className="mt-4 text-neutral-600 dark:text-neutral-400">{who ? `${who} 님으로 로그인됨.` : "로그인됨."}</p>
      <p className="mt-2 text-sm text-neutral-500">관리 기능은 여기에 순차적으로 추가됩니다.</p>
      <form action="/api/auth/signout" method="post" className="mt-8">
        <button
          type="submit"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          로그아웃
        </button>
      </form>
    </main>
  );
}
