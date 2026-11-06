import type { Plugin } from 'vite';

declare const process: {
  env?: Record<string, string | undefined>;
};

/**
 * Normalizes a site URL by trimming whitespace and removing any trailing slashes.
 */
export function normalizeSiteUrl(url?: string): string {
  if (!url) return '';
  return url.trim().replace(/\/+$/, '');
}

/**
 * Rewrites a meta tag's content attribute for a given property/name attribute.
 */
function replaceMetaContent(
  html: string,
  attributeName: 'property' | 'name',
  attributeValue: string,
  newContent: string,
): string {
  // Pattern 1: <meta ... property="xyz" ... content="..." ...>
  const pattern1 = new RegExp(
    `(<meta\\b(?=[^>]*\\b${attributeName}=["']${attributeValue}["'])[^>]*\\bcontent=["'])([^"']*)(["'][^>]*>)`,
    'i',
  );
  if (pattern1.test(html)) {
    return html.replace(pattern1, `$1${newContent}$3`);
  }

  // Pattern 2: <meta ... content="..." ... property="xyz" ...>
  const pattern2 = new RegExp(
    `(<meta\\b[^>]*\\bcontent=["'])([^"']*)(["'][^>]*\\b${attributeName}=["']${attributeValue}["'][^>]*>)`,
    'i',
  );
  if (pattern2.test(html)) {
    return html.replace(pattern2, `$1${newContent}$3`);
  }

  return html;
}

/**
 * Transforms index.html to ensure absolute URLs for OpenGraph and Twitter card previews
 * when VITE_SITE_URL is configured at build time. When unset or empty, HTML is untouched.
 */
export function transformSiteUrl(html: string, rawSiteUrl?: string): string {
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  if (!siteUrl) {
    return html;
  }

  let result = html;

  // Rewrite og:image and twitter:image to absolute URLs
  result = replaceMetaContent(result, 'property', 'og:image', `${siteUrl}/brand/og-image.png`);
  result = replaceMetaContent(result, 'name', 'twitter:image', `${siteUrl}/brand/og-image.png`);

  // Rewrite or inject og:url to site root
  const hasOgUrl = /(?:property=["']og:url["']|name=["']og:url["'])/i.test(result);
  if (hasOgUrl) {
    result = replaceMetaContent(result, 'property', 'og:url', `${siteUrl}/`);
  } else if (/<\/head>/i.test(result)) {
    result = result.replace(/<\/head>/i, `    <meta property="og:url" content="${siteUrl}/" />\n  </head>`);
  }

  return result;
}

/**
 * Vite plugin that injects absolute OpenGraph / Twitter metadata during build when
 * VITE_SITE_URL is defined.
 */
export function siteUrlPlugin(siteUrl?: string): Plugin {
  return {
    name: 'gt-site-url',
    transformIndexHtml(html: string) {
      const configuredUrl = siteUrl ?? (typeof process !== 'undefined' ? process.env?.['VITE_SITE_URL'] : undefined);
      return transformSiteUrl(html, configuredUrl);
    },
  };
}
