export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  opacity: number;       // 0.01 ~ 0.5 (default: 0.07, 7%)
  fontSize: number;      // px (default: 18)
  gapX: number;          // px horizontal repeat spacing (default: 180)
  gapY: number;          // px vertical repeat spacing (default: 120)
  angle: number;         // deg, -45 ~ 45 (default: -25)
  direction: 'diagonal-down' | 'diagonal-up' | 'horizontal'; // diagonal-down is -25deg, diagonal-up is 25deg, horizontal is 0deg
  color: string;         // e.g. '#000000' or '#1e293b'
}

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: true,
  text: 'FARACOM',
  opacity: 0.07,
  fontSize: 20,
  gapX: 180,
  gapY: 130,
  angle: -25,
  direction: 'diagonal-down',
  color: '#000000',
};

/**
 * Generates a seamless, staggered (brick-pattern) SVG watermark as a Base64 data URI.
 * This completely avoids browser CSS quote/percent-sign parsing bugs and ensures
 * instant reactive updates across opacity, size, gap, and direction changes.
 */
export function getWatermarkSvgDataUrl(settings: WatermarkSettings): string {
  if (!settings.enabled || !settings.text?.trim()) return '';

  const angle =
    settings.direction === 'horizontal'
      ? 0
      : settings.direction === 'diagonal-up'
      ? (settings.angle > 0 ? settings.angle : 25)
      : (settings.angle < 0 ? settings.angle : -25);

  const gapX = Math.max(80, Number(settings.gapX) || 180);
  const gapY = Math.max(50, Number(settings.gapY) || 130);
  const fontSize = Math.max(10, Number(settings.fontSize) || 20);
  const opacity = Math.min(1, Math.max(0.01, Number(settings.opacity) ?? 0.07));
  const color = settings.color || '#000000';
  const text = (settings.text || 'FARACOM').trim();

  // Staggered brick pattern:
  // Tile dimensions: width = gapX, height = gapY * 2
  // Row 1 (y = gapY * 0.5): text centered at x = gapX * 0.5
  // Row 2 (y = gapY * 1.5): text centered at x = 0 AND at x = gapX (wraps seamlessly across tile borders)
  const tileWidth = gapX;
  const tileHeight = gapY * 2;

  const xmlEscapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileWidth}" height="${tileHeight}" viewBox="0 0 ${tileWidth} ${tileHeight}">
  <style>
    .wm {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", Arial, sans-serif;
      font-weight: 800;
      font-size: ${fontSize}px;
      fill: ${color};
      fill-opacity: ${opacity};
      text-anchor: middle;
      dominant-baseline: central;
      user-select: none;
    }
  </style>
  <text class="wm" transform="translate(${tileWidth * 0.5}, ${gapY * 0.5}) rotate(${angle})">${xmlEscapedText}</text>
  <text class="wm" transform="translate(0, ${gapY * 1.5}) rotate(${angle})">${xmlEscapedText}</text>
  <text class="wm" transform="translate(${tileWidth}, ${gapY * 1.5}) rotate(${angle})">${xmlEscapedText}</text>
</svg>`;

  try {
    const base64 = typeof window !== 'undefined'
      ? window.btoa(unescape(encodeURIComponent(svg)))
      : Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (err) {
    console.error('Failed to base64 encode watermark SVG:', err);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
}

/**
 * Returns React inline style with the repeating watermark background.
 */
export function getWatermarkBackgroundStyle(settings: WatermarkSettings): React.CSSProperties {
  if (!settings.enabled || !settings.text?.trim()) {
    return {};
  }
  const dataUrl = getWatermarkSvgDataUrl(settings);
  if (!dataUrl) return {};
  return {
    backgroundImage: `url("${dataUrl}")`,
    backgroundRepeat: 'repeat',
  };
}

