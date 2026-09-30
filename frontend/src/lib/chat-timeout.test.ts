import { describe, expect, it } from "vitest";
import { CHAT_UPSTREAM_TIMEOUT_MS } from "./chat-timeout";

describe("chat timeout", () => {
  it("allows slower creative workflows while leaving time for the route to respond", () => {
    expect(CHAT_UPSTREAM_TIMEOUT_MS).toBe(110_000);
    expect(CHAT_UPSTREAM_TIMEOUT_MS).toBeLessThan(120_000);
  });
});
