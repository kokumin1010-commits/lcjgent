import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceFiles = [
  "client/src/pages/BrandSampleLP.tsx",
  "client/src/pages/BrandSimulationView.tsx",
  "client/src/pages/BrandPortal.tsx",
];
const assetFiles = [
  "client/public/brand-sample/brand-assets/lcj-logo-horizontal.png",
  "client/public/brand-sample/brand-assets/lcj-logo-square.webp",
  "client/public/brand-sample/brand-assets/kyogoku.webp",
  "client/public/brand-sample/brand-assets/dds-renovatio.webp",
  "client/public/brand-sample/brand-assets/mistine.webp",
  "client/public/brand-sample/brand-assets/recore-serum.webp",
  "client/public/brand-sample/brand-assets/spa-treatment.webp",
  "client/public/brand-sample/brand-assets/fair-and-white.webp",
];

function text(path: string) {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("Brand Sample local image assets", () => {
  it("does not reference the expired CloudFront image set", () => {
    for (const file of sourceFiles) {
      const source = text(file);
      expect(source).not.toContain("d2xsxph8kpxj0f.cloudfront.net/310519663045992616");
      expect(source).not.toContain("lcj_logo_e21ead0b.jpg");
    }
  });

  it("maps every visible brand result to a local image without hiding failures", () => {
    const source = text("client/src/pages/BrandSampleLP.tsx");
    for (const asset of assetFiles.slice(2)) {
      expect(source).toContain(`/${asset.replace("client/public/", "")}`);
    }
    expect(source).not.toContain("style.display='none'");
    expect(source).toContain("object-contain bg-white");
    expect(source).toContain('className="w-10 h-10 rounded-xl object-contain bg-white" loading="lazy"');
  });

  it("ships every referenced logo and brand image as a non-empty local file", () => {
    for (const file of assetFiles) {
      const path = resolve(projectRoot, file);
      expect(existsSync(path), file).toBe(true);
      expect(statSync(path).size, file).toBeGreaterThan(1_000);
    }
  });
});
