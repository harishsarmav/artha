import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const outputDir = join(root, "output");
await mkdir(outputDir, { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".wav": "audio/wav", ".webm": "video/webm", ".mp4": "video/mp4" };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "POST" && url.pathname === "/save-video") {
      const format = url.searchParams.get("format");
      if (format !== "mp4" && format !== "webm") { res.writeHead(400).end("Unsupported video format"); return; }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 180 * 1024 * 1024) { res.writeHead(413).end("Video too large"); return; }
        chunks.push(chunk);
      }
      const path = join(outputDir, `DhanView-demo.${format}`);
      await writeFile(path, Buffer.concat(chunks));
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ bytes: size }));
      console.log(`VIDEO_SAVED ${path} (${size} bytes)`);
      return;
    }
    if (req.method !== "GET") { res.writeHead(405).end("GET or POST required"); return; }
    const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const path = normalize(join(root, requested));
    const rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel)) { res.writeHead(403).end("Forbidden"); return; }
    const content = await readFile(path);
    res.writeHead(200, { "Content-Type": types[extname(path)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(content);
  } catch {
    if (res.destroyed || res.writableEnded) return;
    if (!res.headersSent) res.writeHead(404);
    res.end("Not found");
  }
}).listen(4178, "127.0.0.1", () => console.log("DEMO_VIDEO_SERVER http://127.0.0.1:4178/"));
