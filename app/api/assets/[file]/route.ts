import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_NAME } from "@/lib/content/assets";

const TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};

const ROOT = path.join(process.cwd(), "content", "assets");

export async function GET(_req: Request, ctx: RouteContext<"/api/assets/[file]">) {
  const { file } = await ctx.params;
  // Strict allow-list on the name, so no path segments or traversal can reach the filesystem.
  if (!ASSET_NAME.test(file)) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(path.join(ROOT, file));
    const ext = file.split(".").pop()!.toLowerCase();
    return new Response(body, {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        // SVGs are authored by contributors; never let one run script in our origin.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
