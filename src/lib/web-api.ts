const DEFAULT_WEB_API = "https://dongflix-web-api.dongflix-web-gateway-worker.workers.dev";

export function webApiUrl(path: string) {
  const origin = (process.env.NEXT_PUBLIC_DONGFLIX_WEB_API_URL || DEFAULT_WEB_API).replace(/\/+$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
