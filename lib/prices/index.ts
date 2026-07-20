import type { PriceProvider } from "./types";
import { YahooPriceProvider } from "./yahoo";

// Single place that decides which provider is active. Swap this to change feeds.
export function getPriceProvider(): PriceProvider {
  return new YahooPriceProvider();
}

export type { PriceProvider, Quote } from "./types";
