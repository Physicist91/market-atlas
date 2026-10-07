import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function isValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.hostname.toLowerCase();

    // Allow all Google Cloud Run, AI Studio, and local dev origins
    if (
      originHost.endsWith(".run.app") ||
      originHost.endsWith(".google.com") ||
      originHost.endsWith(".googleusercontent.com") ||
      originHost.endsWith(".aistudio.google.com") ||
      originHost.endsWith(".vercel.app") ||
      originHost === "localhost" ||
      originHost === "127.0.0.1" ||
      originHost === "0.0.0.0"
    ) {
      return true;
    }

    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!host) return true;

    const requestHost = host.split(":")[0].toLowerCase();
    if (originHost === requestHost) return true;

    return false;
  } catch {
    return true;
  }
}
