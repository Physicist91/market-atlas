import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return true;

  try {
    const originUrl = new URL(origin);
    const requestHost = host.split(":")[0].toLowerCase();
    const originHost = originUrl.hostname.toLowerCase();

    if (originHost === requestHost) return true;
    if (
      (originHost === "localhost" || originHost === "127.0.0.1") &&
      (requestHost === "localhost" || requestHost === "127.0.0.1")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
