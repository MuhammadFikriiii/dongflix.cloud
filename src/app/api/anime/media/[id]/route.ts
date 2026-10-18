import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const PIXELDRAIN_ID = /^[A-Za-z0-9_-]{6,32}$/;

async function proxyMedia(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!PIXELDRAIN_ID.test(id)) {
    return NextResponse.json({ error: "invalid_media_id" }, { status: 400 });
  }
  const expires = request.nextUrl.searchParams.get("expires") ?? "";
  const signature = request.nextUrl.searchParams.get("signature") ?? "";
  const mediaSecret = process.env.DONGFLIX_ANIME_RESOLVER_WORKER_KEY
    ?? process.env.DONGFLIX_RESOLVER_WORKER_KEY;
  const expected = mediaSecret
    ? createHmac("sha256", mediaSecret).update(`${id}:${expires}`).digest()
    : Buffer.alloc(0);
  const supplied = Buffer.from(signature, "base64url");
  if (!expires || Number(expires) < Date.now() || expected.length !== supplied.length
    || !timingSafeEqual(expected, supplied)) {
    return NextResponse.json({ error: "invalid_media_token" }, { status: 403 });
  }

  const headers = new Headers({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
    Referer: "https://pixeldrain.com/",
  });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);

  try {
    const upstream = await fetch(`https://pixeldrain.com/api/file/${id}`, {
      method: request.method,
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "media_unavailable" }, { status: upstream.status });
    }

    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "public, max-age=300");
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json({ error: "media_proxy_failed" }, { status: 502 });
  }
}

export const GET = proxyMedia;
export const HEAD = proxyMedia;
