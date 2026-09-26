import { unstable_cache } from "next/cache";
import { isOneDriveConfigured, readText } from "@/lib/onedrive/graph";

/**
 * 사이트가 읽는 OneDrive 텍스트(site-data, 원페이저, Ask Hansol 문맥)를 Next 데이터 캐시에 얹는다.
 * Graph 조회는 콜드 스타트에 1~3초 걸려서, 인스턴스 사이에서 공유되는 캐시(5분 재검증, stale-while-revalidate)
 * 가 페이지 응답 시간을 지킨다. 파일을 고치면 보통 5분 안팎, 늦어도 10분 안에 반영된다(재검증은 요청이 올 때 뒤에서 돈다).
 */
const REVALIDATE_SECONDS = Number(process.env.ONEDRIVE_TEXT_REVALIDATE_SECONDS ?? 300);

const cachedRead = unstable_cache(async (relPath: string) => readText(relPath, { fresh: true }), ["onedrive-text-v2"], {
  revalidate: REVALIDATE_SECONDS,
  tags: ["onedrive-text"],
});

/** OneDrive `hsol-info-blob/<relPath>` 텍스트. 설정이 없거나 실패하면 null. */
export async function readOneDriveText(relPath: string): Promise<string | null> {
  if (!isOneDriveConfigured()) return null;
  try {
    return await cachedRead(relPath);
  } catch {
    // Next 요청 컨텍스트 밖(스크립트)이면 데이터 캐시를 못 쓴다. 인메모리 캐시만 쓰는 직접 읽기로.
    try {
      return await readText(relPath);
    } catch {
      return null;
    }
  }
}
