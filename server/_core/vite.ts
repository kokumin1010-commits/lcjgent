import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

/**
 * Replace dynamic SEO placeholders in the HTML template.
 * __CANONICAL_URL__ → full request URL
 * __OG_URL__ → same as canonical
 */
function injectSeoMeta(html: string, reqUrl: string, baseUrl: string): string {
  const fullUrl = reqUrl === "/" ? baseUrl : `${baseUrl}${reqUrl.split("?")[0]}`;
  return html
    .replace(/__CANONICAL_URL__/g, fullUrl)
    .replace(/__OG_URL__/g, fullUrl);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      let page = await vite.transformIndexHtml(url, template);
      // Inject dynamic SEO meta (canonical, og:url)
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      page = injectSeoMeta(page, url, baseUrl);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Serve static assets with aggressive caching (hashed filenames)
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
  }));

  // Serve other static files with short cache
  app.use(express.static(distPath, {
    maxAge: "1h",
    etag: true,
  }));

  // Read the index.html template once for dynamic SEO injection
  const indexPath = path.resolve(distPath, "index.html");
  let indexTemplate = "";
  try {
    indexTemplate = fs.readFileSync(indexPath, "utf-8");
  } catch (e) {
    console.error("[serveStatic] Failed to read index.html:", e);
  }

  // fall through to index.html if the file doesn't exist (SPA)
  // Inject dynamic canonical/og:url based on request URL
  app.use("*", (req, res) => {
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const html = injectSeoMeta(indexTemplate, req.originalUrl, baseUrl);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
}
