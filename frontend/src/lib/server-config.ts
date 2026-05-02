export type ClientResolution =
  | { ok: true; clientName: string }
  | { ok: false; status: number; error: string };

export function resolveClientName(requestedClient?: string | null): ClientResolution {
  const clientName = (requestedClient || process.env.ADSPULSE_DEFAULT_CLIENT_NAME || "").trim();

  if (!clientName) {
    return { ok: false, status: 500, error: "Default client is not configured" };
  }

  const allowedClients = (process.env.ADSPULSE_ALLOWED_CLIENTS || "")
    .split(",")
    .map((client) => client.trim())
    .filter(Boolean);

  if (allowedClients.length > 0 && !allowedClients.includes(clientName)) {
    return { ok: false, status: 403, error: "Client is not authorized for this deployment" };
  }

  return { ok: true, clientName };
}
