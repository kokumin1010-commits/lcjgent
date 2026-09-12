/**
 * LCF page metadata helper.
 * Design rule: each public archive route owns a stable canonical URL and factual Japanese copy.
 */
type PageSeoOptions = {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
};

const upsertMeta = (selector: string, attributes: Record<string, string>) => {
  let node = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!node) {
    node = document.createElement("meta");
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) => node!.setAttribute(key, value));
};

export function applyPageSeo({ title, description, canonicalPath, image, type = "website", jsonLd }: PageSeoOptions) {
  const origin = window.location.origin;
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  document.title = title;

  upsertMeta('meta[name="description"]', { name: "description", content: description });
  upsertMeta('meta[name="robots"]', { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: type });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonicalUrl });
  upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
  upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "LIVE COMMERCE FESTIVAL" });
  upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "ja_JP" });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: description });
  upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  document.querySelectorAll('script[data-lcf-page-jsonld="true"]').forEach((node) => node.remove());
  if (jsonLd) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.lcfPageJsonld = "true";
    script.textContent = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
    document.head.appendChild(script);
  }
}
