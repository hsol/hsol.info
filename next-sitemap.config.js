/**
 * @deprecated next-sitemap을 제거하고 자체 빌더(`scripts/build-sitemap.ts`)로 교체했다.
 * 이 파일은 안전한 삭제를 위해 비워 두었고, 다음 정리 커밋에서 제거 예정.
 *
 * - postbuild 트리거: package.json `postbuild` → `tsx scripts/build-sitemap.ts`
 * - 생성 결과: `public/sitemap.xml`
 *
 * (Cowork 샌드박스 권한 제약으로 파일 자체를 지우지 못해 빈 모듈로 비움.)
 */
module.exports = {};
