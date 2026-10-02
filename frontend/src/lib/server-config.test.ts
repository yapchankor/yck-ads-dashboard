import { describe, it, expect, afterEach } from "vitest";
import { resolveClientName } from "./server-config";

describe("resolveClientName tenant resolution", () => {
  const originalDefault = process.env.ADSPULSE_DEFAULT_CLIENT_NAME;
  const originalAllowed = process.env.ADSPULSE_ALLOWED_CLIENTS;

  afterEach(() => {
    process.env.ADSPULSE_DEFAULT_CLIENT_NAME = originalDefault;
    process.env.ADSPULSE_ALLOWED_CLIENTS = originalAllowed;
  });

  it("resolves YAP CHAN KOR when configured as default tenant", () => {
    process.env.ADSPULSE_DEFAULT_CLIENT_NAME = "YAP CHAN KOR";
    process.env.ADSPULSE_ALLOWED_CLIENTS = "YAP CHAN KOR";

    const res = resolveClientName();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.clientName).toBe("YAP CHAN KOR");
    }
  });

  it("resolves GENERA when configured as default tenant", () => {
    process.env.ADSPULSE_DEFAULT_CLIENT_NAME = "GENERA";
    process.env.ADSPULSE_ALLOWED_CLIENTS = "GENERA";

    const res = resolveClientName();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.clientName).toBe("GENERA");
    }
  });

  it("blocks unauthorized tenant request if not in allowed clients", () => {
    process.env.ADSPULSE_DEFAULT_CLIENT_NAME = "YAP CHAN KOR";
    process.env.ADSPULSE_ALLOWED_CLIENTS = "YAP CHAN KOR";

    const res = resolveClientName("GENERA");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(403);
    }
  });

  it("fails closed when default client is missing", () => {
    delete process.env.ADSPULSE_DEFAULT_CLIENT_NAME;
    process.env.ADSPULSE_ALLOWED_CLIENTS = "";

    const res = resolveClientName();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(500);
    }
  });
});
