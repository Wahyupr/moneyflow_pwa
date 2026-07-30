import { describe, expect, it } from "vitest";

import { isMoneyFlowCacheName, shouldRegisterServiceWorker } from "../../components/service-worker-registration";

describe("service worker registration policy", () => {
  it("registers only in production browser contexts", () => {
    expect(shouldRegisterServiceWorker("production", true)).toBe(true);
    expect(shouldRegisterServiceWorker("development", true)).toBe(false);
    expect(shouldRegisterServiceWorker("test", true)).toBe(false);
    expect(shouldRegisterServiceWorker("production", false)).toBe(false);
  });

  it("only clears MoneyFlow caches during development cleanup", () => {
    expect(isMoneyFlowCacheName("mf-shell-v5")).toBe(true);
    expect(isMoneyFlowCacheName("mf-static-v6")).toBe(true);
    expect(isMoneyFlowCacheName("mf-api-v1")).toBe(true);
    expect(isMoneyFlowCacheName("other-app-cache")).toBe(false);
  });
});
