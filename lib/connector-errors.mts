/** Validate and project runtime results onto the public connector response. */
export function connectorResponse(result: unknown): Response {
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

/** Presentation only. The caller supplies the starter's server-generated SIWC URL. */
export function connectorErrorRecovery(
  error: { status: string; message: string },
  connectorName: string,
  reconnectHref: string,
): { message: string; action?: { label: string; href: string } } {
  if (error.status === "reauthentication_required") {
    return {
      message: error.message,
      action: { label: `Connect ${connectorName}`, href: reconnectHref },
    };
  }
  return { message: error.message };
}
