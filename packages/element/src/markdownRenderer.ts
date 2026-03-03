/**
 * Renders markdown text to a canvas bitmap using SVG foreignObject.
 *
 * Flow: markdown text → HTML string → SVG foreignObject → Image → Canvas drawImage
 *
 * Uses a simple built-in markdown parser (no external dependencies) to keep
 * the core package dependency-free.
 */

// ---------------------------------------------------------------------------
// Minimal markdown → HTML parser (covers common syntax, no dependencies)
// ---------------------------------------------------------------------------

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const parseInline = (text: string): string => {
  return (
    text
      // bold+italic
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      // bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      // italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      // strikethrough
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      // inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
  );
};

const parseMarkdown = (md: string): string => {
  const lines = md.split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let inList = false;
  let listTag = "";

  const closeList = () => {
    if (inList) {
      html.push(`</${listTag}>`);
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // fenced code block
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        html.push(
          `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        closeList();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // blank line
    if (line.trim() === "") {
      closeList();
      continue;
    }

    // headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList();
      html.push("<hr/>");
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      closeList();
      html.push(`<blockquote>${parseInline(line.slice(2))}</blockquote>`);
      continue;
    }

    // unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listTag !== "ul") {
        closeList();
        html.push("<ul>");
        inList = true;
        listTag = "ul";
      }
      html.push(`<li>${parseInline(ulMatch[2])}</li>`);
      continue;
    }

    // ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listTag !== "ol") {
        closeList();
        html.push("<ol>");
        inList = true;
        listTag = "ol";
      }
      html.push(`<li>${parseInline(olMatch[2])}</li>`);
      continue;
    }

    // paragraph
    closeList();
    html.push(`<p>${parseInline(line)}</p>`);
  }

  // close unclosed blocks
  if (inCodeBlock) {
    html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }
  closeList();

  return html.join("");
};

// ---------------------------------------------------------------------------
// SVG foreignObject → Canvas rendering with cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  image: HTMLImageElement;
  key: string;
}

const markdownImageCache = new Map<string, CacheEntry>();
// pending renders to avoid duplicate work
const pendingRenders = new Map<string, Promise<HTMLImageElement>>();

const MAX_CACHE_SIZE = 200;

const getCacheKey = (
  text: string,
  width: number,
  height: number,
  fontSize: number,
  color: string,
  theme: string,
) => `${text}::${width}::${height}::${fontSize}::${color}::${theme}`;

const buildSvgMarkdown = (
  html: string,
  width: number,
  height: number,
  fontSize: number,
  color: string,
  textAlign: string,
): string => {
  // Scale up for crisp rendering
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const svgWidth = Math.ceil(width * dpr);
  const svgHeight = Math.ceil(height * dpr);
  const scaledFontSize = fontSize * dpr;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${scaledFontSize}px;
      color: ${color};
      text-align: ${textAlign};
      line-height: 1.35;
      word-wrap: break-word;
      overflow: hidden;
      width: ${svgWidth}px;
      height: ${svgHeight}px;
      box-sizing: border-box;
    ">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        h1 { font-size: 1.6em; font-weight: 700; margin-bottom: 0.3em; line-height: 1.2; }
        h2 { font-size: 1.35em; font-weight: 600; margin-bottom: 0.25em; line-height: 1.25; }
        h3 { font-size: 1.15em; font-weight: 600; margin-bottom: 0.2em; line-height: 1.3; }
        h4,h5,h6 { font-size: 1em; font-weight: 600; margin-bottom: 0.15em; }
        p { margin-bottom: 0.4em; line-height: 1.5; }
        ul,ol { margin-bottom: 0.4em; padding-left: 1.5em; line-height: 1.5; }
        li { margin-bottom: 0.15em; }
        code { font-family: 'Cascadia Code','Fira Code',monospace; background: rgba(128,128,128,0.15); padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.88em; }
        pre { margin: 0.3em 0; padding: 0.5em 0.7em; background: rgba(128,128,128,0.1); border-radius: 4px; overflow-x: auto; }
        pre code { background: none; padding: 0; font-size: 0.85em; }
        blockquote { margin: 0.3em 0; padding: 0.2em 0 0.2em 0.8em; border-left: 3px solid rgba(128,128,128,0.4); opacity: 0.8; }
        strong { font-weight: 700; }
        em { font-style: italic; }
        hr { border: none; border-top: 1px solid rgba(128,128,128,0.3); margin: 0.5em 0; }
        del { text-decoration: line-through; }
      </style>
      ${html}
    </div>
  </foreignObject>
</svg>`;
};

const renderSvgToImage = (svgString: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      svgString,
    )}`;
  });
};

// Callback invoked when an async markdown render completes.
// The host should set this to trigger a scene re-render.
let onMarkdownRendered: (() => void) | null = null;

export const setOnMarkdownRendered = (cb: (() => void) | null) => {
  onMarkdownRendered = cb;
};

/**
 * Render markdown text element onto canvas context.
 * Returns true if rendered (sync from cache), false if still loading (async).
 */
export const renderMarkdownOnCanvas = (
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  fontSize: number,
  color: string,
  textAlign: string,
  theme: string,
): boolean => {
  const key = getCacheKey(text, width, height, fontSize, color, theme);
  const cached = markdownImageCache.get(key);

  if (cached) {
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    context.drawImage(
      cached.image,
      0,
      0,
      width * dpr,
      height * dpr,
      0,
      0,
      width,
      height,
    );
    return true;
  }

  // Start async render if not already pending
  if (!pendingRenders.has(key)) {
    const html = parseMarkdown(text);
    const svg = buildSvgMarkdown(
      html,
      width,
      height,
      fontSize,
      color,
      textAlign,
    );
    const promise = renderSvgToImage(svg);

    pendingRenders.set(key, promise);

    promise
      .then((img) => {
        // Evict old entries if cache is full
        if (markdownImageCache.size >= MAX_CACHE_SIZE) {
          const firstKey = markdownImageCache.keys().next().value;
          if (firstKey) {
            markdownImageCache.delete(firstKey);
          }
        }
        markdownImageCache.set(key, { image: img, key });
        pendingRenders.delete(key);

        // Notify host to re-render the scene
        onMarkdownRendered?.();
      })
      .catch(() => {
        pendingRenders.delete(key);
      });
  }

  // While loading, return false — caller should fall back to plain text
  return false;
};

/**
 * Clear the markdown render cache (call when theme changes, etc.)
 */
export const clearMarkdownCache = () => {
  markdownImageCache.clear();
  pendingRenders.clear();
};
