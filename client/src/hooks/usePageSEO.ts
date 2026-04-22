import { useEffect } from "react";

interface PageSEOOptions {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string;
  noindex?: boolean;
}

function setMetaTag(property: string, content: string) {
  const isOg = property.startsWith("og:") || property.startsWith("article:") || property.startsWith("twitter:");
  const selector = isOg
    ? `meta[property="${property}"]`
    : `meta[name="${property}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement;
  if (el) {
    el.setAttribute("content", content);
  } else {
    el = document.createElement("meta");
    if (isOg) {
      el.setAttribute("property", property);
    } else {
      el.setAttribute("name", property);
    }
    el.setAttribute("content", content);
    document.head.appendChild(el);
  }
}

/**
 * usePageSEO - Set page-level SEO meta tags dynamically.
 * Updates title, description, canonical, OGP, and Twitter Card tags.
 * Restores defaults on unmount.
 */
export function usePageSEO(options: PageSEOOptions) {
  useEffect(() => {
    const defaultTitle = "LCJ MALL - TikTok Shopで買う。そのすべてが、価値になる。";
    const defaultDesc = "LCJ Mallは、TikTok Shopで購入したすべての商品を対象に、ポイントが貯まり、LCJモールで使えるLCJ公式ショッピングサービスです。購入金額の1%還元。";

    // Title
    document.title = options.title ? `${options.title} | LCJ MALL` : defaultTitle;

    // Description
    if (options.description) {
      setMetaTag("description", options.description);
    }

    // Canonical
    const canonicalUrl = options.canonical || window.location.href.split("?")[0];
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonicalLink) {
      canonicalLink.href = canonicalUrl;
    } else {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      canonicalLink.href = canonicalUrl;
      document.head.appendChild(canonicalLink);
    }

    // OGP
    setMetaTag("og:title", options.ogTitle || options.title || defaultTitle);
    setMetaTag("og:description", options.ogDescription || options.description || defaultDesc);
    setMetaTag("og:url", canonicalUrl);
    if (options.ogType) setMetaTag("og:type", options.ogType);
    if (options.ogImage) setMetaTag("og:image", options.ogImage);

    // Twitter Card
    setMetaTag("twitter:title", options.ogTitle || options.title || defaultTitle);
    setMetaTag("twitter:description", options.ogDescription || options.description || defaultDesc);
    if (options.ogImage) setMetaTag("twitter:image", options.ogImage);

    // Keywords
    if (options.keywords) {
      setMetaTag("keywords", options.keywords);
    }

    // Robots
    if (options.noindex) {
      setMetaTag("robots", "noindex, nofollow");
    }

    // hreflang
    let hreflangJa = document.querySelector('link[hreflang="ja"]') as HTMLLinkElement;
    if (!hreflangJa) {
      hreflangJa = document.createElement("link");
      hreflangJa.rel = "alternate";
      hreflangJa.hreflang = "ja";
      document.head.appendChild(hreflangJa);
    }
    hreflangJa.href = canonicalUrl;

    let hreflangDefault = document.querySelector('link[hreflang="x-default"]') as HTMLLinkElement;
    if (!hreflangDefault) {
      hreflangDefault = document.createElement("link");
      hreflangDefault.rel = "alternate";
      hreflangDefault.hreflang = "x-default";
      document.head.appendChild(hreflangDefault);
    }
    hreflangDefault.href = canonicalUrl;

    return () => {
      // Restore defaults
      document.title = defaultTitle;
      setMetaTag("description", defaultDesc);
      if (canonicalLink) {
        canonicalLink.href = window.location.origin;
      }
      setMetaTag("og:title", defaultTitle);
      setMetaTag("og:description", defaultDesc);
      setMetaTag("og:url", window.location.origin);
      setMetaTag("twitter:title", defaultTitle);
      setMetaTag("twitter:description", defaultDesc);
      setMetaTag("robots", "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    };
  }, [options.title, options.description, options.canonical, options.ogTitle, options.ogDescription, options.ogImage, options.ogType, options.keywords, options.noindex]);
}
