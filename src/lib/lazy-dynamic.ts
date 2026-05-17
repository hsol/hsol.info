import dynamic, { type DynamicOptions } from "next/dynamic";
import type { ComponentType } from "react";

/** Next 기본 prefetch/preload 없이 지연 청크만 로드 */
export function lazy<P = Record<string, never>>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options?: Omit<DynamicOptions<P>, "loading"> & {
    loading?: DynamicOptions<P>["loading"];
  },
) {
  return dynamic(loader, {
    ssr: false,
    webpackPrefetch: false,
    webpackPreload: false,
    ...options,
  });
}
