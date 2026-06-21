import { permanentRedirect } from "next/navigation";

/**
 * 정본 소개 경로가 /about으로 바뀌었다. 과거 /imhansol 진입은 308로 영구 이전.
 * (이 라우트는 배포된 적 없으므로 로컬에서 폴더째 삭제해도 무방하다.)
 */
export default function ImhansolRedirect(): never {
  permanentRedirect("/about");
}
