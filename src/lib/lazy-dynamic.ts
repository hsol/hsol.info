import dynamic, { type DynamicOptions, type Loader } from "next/dynamic";
import type { ComponentProps, ComponentType } from "react";

/**
 * Next 기본 prefetch/preload 없이 지연 청크만 로드.
 *
 * 제네릭은 컴포넌트 타입 `T` 자체를 추론한다. `ComponentType<P>` 안의 `P` 를 추론하게 두면
 * TS 가 `ComponentType` 의 클래스 분기를 시도하다 `P` 를 `never` 로 무너뜨려(반공변)
 * 모든 호출부에서 prop 타입이 깨졌다 — 그래서 default export 전체를 한 번에 잡는다.
 */
export function lazy<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  options?: Omit<DynamicOptions<ComponentProps<T>>, "loading"> & {
    loading?: DynamicOptions<ComponentProps<T>>["loading"];
  },
): T {
  // webpackPrefetch/Preload 는 DynamicOptions 정식 키가 아니라 의도 표식일 뿐이라(실제
  // 제어는 import 매직 코멘트) 리터럴을 캐스팅해 초과 프로퍼티 검사를 우회한다.
  return dynamic(loader as unknown as Loader<ComponentProps<T>>, {
    ssr: false,
    webpackPrefetch: false,
    webpackPreload: false,
    ...options,
  } as DynamicOptions<ComponentProps<T>>) as unknown as T;
}
