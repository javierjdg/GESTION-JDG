import { jsPDF } from 'jspdf';

/**
 * Raw SVG markup of the JDG TELECO corporate logo,
 * matching the official branding (lime green 'J', deep teal 'DG',
 * teal 'TELECO' box with target 'O', and the radar vortex swirl with ruby center dot).
 */
export const JDG_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 100" width="280" height="100">
  <defs>
    <radialGradient id="jdgGreenCenter" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#bada36" />
      <stop offset="60%" stop-color="#9ec82c" />
      <stop offset="100%" stop-color="#0e837d" />
    </radialGradient>
  </defs>

  <!-- Left: Letter J in Lime Green (#9ec82c) -->
  <g fill="#9ec82c">
    <!-- Top slab serif and vertical stem down to bottom hook -->
    <path d="M 8,10 L 25,10 L 25,17 L 19,17 L 19,74 C 19,82.5 15.5,92 5,92 C 1.2,92 0,88.5 0,84 C 0,80 3.2,77.5 6.5,77.5 C 9.8,77.5 12,79.8 12,83.2 C 12,85.2 10.8,86.5 9.2,86.8 C 10.2,87.8 11.8,88.2 13.8,88.2 C 16.8,88.2 18,83.5 18,76 L 18,17 L 8,17 Z" />
  </g>

  <!-- Left: Letters DG in Deep Teal (#00787a) -->
  <g fill="#00787a">
    <!-- Letter D -->
    <path d="M 36,10 L 61,10 C 76,10 83,21 83,36 C 83,51 76,62 61,62 L 36,62 Z M 43,17 L 43,55 L 59,55 C 70,55 75.5,47.5 75.5,36 C 75.5,24.5 70,17 59,17 Z" />

    <!-- Letter G -->
    <path d="M 132,20.5 L 126.5,24.5 C 123.5,19 117.5,16.5 110.5,16.5 C 98,16.5 90,26 90,36 C 90,46.5 98,55.5 110.5,55.5 C 119.5,55.5 125,50 125.5,42.5 L 110.5,42.5 L 110.5,36.5 L 132.5,36.5 L 132.5,61 L 127,61 L 126.5,56.5 C 122.5,60.5 116.5,62 110,62 C 94,62 82.5,49.5 82.5,36 C 82.5,22 94.5,10 110.5,10 C 119.5,10 127.5,14 132,20.5 Z" />
  </g>

  <!-- Box: TELECO in Deep Teal with white typography -->
  <g transform="translate(36, 66)">
    <rect x="0" y="0" width="97" height="26" fill="#00787a" rx="1.5" />
    <text x="48.5" y="18.5" font-family="'Courier New', Courier, 'Lucida Console', monospace, sans-serif" font-weight="900" font-size="15" fill="#ffffff" text-anchor="middle" letter-spacing="3.5">TELECO</text>
    <!-- Characteristic target dot inside the O -->
    <circle cx="82.5" cy="13.5" r="2.2" fill="#00787a" />
    <circle cx="82.5" cy="13.5" r="1.1" fill="#ffffff" />
  </g>

  <!-- Right: The Vortex Radar Swirl -->
  <g transform="translate(205, 50)">
    <!-- Central Gradient Disc -->
    <circle cx="0" cy="0" r="16.5" fill="url(#jdgGreenCenter)" />

    <!-- Center Crimson Ruby Dot -->
    <circle cx="0" cy="0" r="3.2" fill="#c8102e" />

    <!-- Inner fine ripples -->
    <circle cx="0" cy="0" r="7" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-opacity="0.8" />
    <circle cx="0" cy="0" r="11.5" fill="none" stroke="#ffffff" stroke-width="0.7" stroke-dasharray="14 4" stroke-opacity="0.6" transform="rotate(-30)" />

    <!-- Swirling Vortex Waves (Teal & Emerald) -->
    <!-- Arc 1 -->
    <path d="M -18,-5 A 19 19 0 0 1 12,-16 A 21 21 0 0 1 23,2" fill="none" stroke="#00787a" stroke-width="2.6" stroke-linecap="round" />
    <!-- Arc 2 -->
    <path d="M 23,6 A 24 24 0 0 1 -4,25 A 25 25 0 0 1 -25,2" fill="none" stroke="#00787a" stroke-width="2.8" stroke-linecap="round" />
    <!-- Arc 3 -->
    <path d="M -26,-2 A 28 28 0 0 1 15,-25 A 29 29 0 0 1 30,-2" fill="none" stroke="#00787a" stroke-width="3" stroke-linecap="round" />
    <!-- Arc 4 -->
    <path d="M 30,4 A 31 31 0 0 1 -10,31 A 32 32 0 0 1 -32,-3" fill="none" stroke="#00787a" stroke-width="2.5" stroke-linecap="round" />
    <!-- Arc 5 -->
    <path d="M -33,-3 A 35 35 0 0 1 20,-30 A 36 36 0 0 1 37,-1" fill="none" stroke="#00787a" stroke-width="2.8" stroke-linecap="round" />
    <!-- Arc 6 -->
    <path d="M 37,2 A 38 38 0 0 1 -18,37 A 39 39 0 0 1 -38,5" fill="none" stroke="#00787a" stroke-width="2.2" stroke-linecap="round" />
    <!-- Arc 7 Outer -->
    <path d="M -38,3 A 41 41 0 0 1 25,-35 A 42 42 0 0 1 42,-5" fill="none" stroke="#00787a" stroke-width="1.8" stroke-linecap="round" />
    <!-- Arc 8 Outer trailing -->
    <path d="M 42,-3 A 43 43 0 0 1 -22,41 A 44 44 0 0 1 -42,10" fill="none" stroke="#00787a" stroke-width="1.4" stroke-linecap="round" />
    
    <!-- Accent Green-Teal Spirals -->
    <path d="M -15,10 A 18 18 0 0 1 -6,-17" fill="none" stroke="#9ec82c" stroke-width="1.5" stroke-linecap="round" />
    <path d="M 12,-15 A 20 20 0 0 1 21,7" fill="none" stroke="#9ec82c" stroke-width="1.4" stroke-linecap="round" />
    <path d="M 18,12 A 22 22 0 0 1 -10,21" fill="none" stroke="#9ec82c" stroke-width="1.5" stroke-linecap="round" />
    <path d="M -22,-14 A 26 26 0 0 1 12,-24" fill="none" stroke="#9ec82c" stroke-width="1.6" stroke-linecap="round" />
  </g>
</svg>`;

// In-memory cached PNG data URL
let cachedPngDataUrl: string | null = null;

/**
 * Returns a high-resolution PNG data URL of the JDG TELECO logo.
 * If running in a browser environment, it converts the crisp vector SVG into an anti-aliased PNG on a canvas.
 */
export function getJdgLogoPngUrl(): string {
  if (cachedPngDataUrl) {
    return cachedPngDataUrl;
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const scale = 4; // High DPI / Crisp output
      canvas.width = 280 * scale;
      canvas.height = 100 * scale;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.scale(scale, scale);

        // Draw directly with precision canvas API for instantaneous synchronous rendering
        // 1. Clear with transparent
        ctx.clearRect(0, 0, 280, 100);

        // 2. Letter J in Lime Green (#9ec82c)
        ctx.fillStyle = '#9ec82c';
        ctx.beginPath();
        // Top serif
        ctx.moveTo(8, 10);
        ctx.lineTo(25, 10);
        ctx.lineTo(25, 17);
        ctx.lineTo(19, 17);
        // Vertical stem down to hook
        ctx.lineTo(19, 74);
        ctx.bezierCurveTo(19, 82.5, 15.5, 92, 5, 92);
        ctx.bezierCurveTo(1.2, 92, 0, 88.5, 0, 84);
        ctx.bezierCurveTo(0, 80, 3.2, 77.5, 6.5, 77.5);
        ctx.bezierCurveTo(9.8, 77.5, 12, 79.8, 12, 83.2);
        ctx.bezierCurveTo(12, 85.2, 10.8, 86.5, 9.2, 86.8);
        ctx.bezierCurveTo(10.2, 87.8, 11.8, 88.2, 13.8, 88.2);
        ctx.bezierCurveTo(16.8, 88.2, 18, 83.5, 18, 76);
        ctx.lineTo(18, 17);
        ctx.lineTo(8, 17);
        ctx.closePath();
        ctx.fill();

        // 3. Letters D & G in Deep Teal (#00787a)
        ctx.fillStyle = '#00787a';

        // Letter D
        ctx.beginPath();
        // Outer D
        ctx.moveTo(36, 10);
        ctx.lineTo(61, 10);
        ctx.bezierCurveTo(76, 10, 83, 21, 83, 36);
        ctx.bezierCurveTo(83, 51, 76, 62, 61, 62);
        ctx.lineTo(36, 62);
        ctx.closePath();
        // Inner D (cutout)
        ctx.moveTo(43, 17);
        ctx.lineTo(43, 55);
        ctx.lineTo(59, 55);
        ctx.bezierCurveTo(70, 55, 75.5, 47.5, 75.5, 36);
        ctx.bezierCurveTo(75.5, 24.5, 70, 17, 59, 17);
        ctx.closePath();
        ctx.fill('evenodd');

        // Letter G
        ctx.beginPath();
        ctx.moveTo(132, 20.5);
        ctx.lineTo(126.5, 24.5);
        ctx.bezierCurveTo(123.5, 19, 117.5, 16.5, 110.5, 16.5);
        ctx.bezierCurveTo(98, 16.5, 90, 26, 90, 36);
        ctx.bezierCurveTo(90, 46.5, 98, 55.5, 110.5, 55.5);
        ctx.bezierCurveTo(119.5, 55.5, 125, 50, 125.5, 42.5);
        ctx.lineTo(110.5, 42.5);
        ctx.lineTo(110.5, 36.5);
        ctx.lineTo(132.5, 36.5);
        ctx.lineTo(132.5, 61);
        ctx.lineTo(127, 61);
        ctx.lineTo(126.5, 56.5);
        ctx.bezierCurveTo(122.5, 60.5, 116.5, 62, 110, 62);
        ctx.bezierCurveTo(94, 62, 82.5, 49.5, 82.5, 36);
        ctx.bezierCurveTo(82.5, 22, 94.5, 10, 110.5, 10);
        ctx.bezierCurveTo(119.5, 10, 127.5, 14, 132, 20.5);
        ctx.closePath();
        ctx.fill();

        // 4. TELECO Box
        ctx.fillStyle = '#00787a';
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(36, 66, 97, 26, 2);
        } else {
          ctx.rect(36, 66, 97, 26);
        }
        ctx.fill();

        // TELECO Text
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 15px "Courier New", Courier, monospace, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Draw with wide spacing
        const txt = "TELECO";
        const startX = 49;
        const spacing = 14.5;
        for (let i = 0; i < txt.length; i++) {
          ctx.fillText(txt[i], startX + (i * spacing), 79.5);
        }
        // Center dot inside O
        ctx.fillStyle = '#00787a';
        ctx.beginPath();
        ctx.arc(startX + 5 * spacing, 79.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(startX + 5 * spacing, 79.5, 1.1, 0, Math.PI * 2);
        ctx.fill();

        // 5. Radar / Vortex Swirl at (205, 50)
        const cx = 205;
        const cy = 50;

        // Gradient disc
        const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 16.5);
        radGrad.addColorStop(0, '#bada36');
        radGrad.addColorStop(0.6, '#9ec82c');
        radGrad.addColorStop(1, '#0e837d');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 16.5, 0, Math.PI * 2);
        ctx.fill();

        // Center red ruby dot
        ctx.fillStyle = '#c8102e';
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
        ctx.fill();

        // Inner ripples
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(cx, cy, 11.5, -0.5, Math.PI * 1.5);
        ctx.stroke();

        // Swirling vortex arcs
        ctx.strokeStyle = '#00787a';
        ctx.lineCap = 'round';

        const swirlArcs = [
          { r: 20, start: -0.2, end: 1.2, width: 2.6 },
          { r: 24, start: 0.5, end: 2.1, width: 2.8 },
          { r: 28, start: 1.3, end: 3.1, width: 3.0 },
          { r: 32, start: 2.2, end: 4.2, width: 2.5 },
          { r: 36, start: 3.2, end: 5.3, width: 2.8 },
          { r: 40, start: 4.2, end: 6.4, width: 2.2 },
          { r: 43, start: 5.2, end: 7.3, width: 1.6 },
        ];

        swirlArcs.forEach(arc => {
          ctx.lineWidth = arc.width;
          ctx.beginPath();
          ctx.arc(cx, cy, arc.r, arc.start, arc.end);
          ctx.stroke();
        });

        // Green accents
        ctx.strokeStyle = '#9ec82c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, 19, 2.5, 3.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, 27, 4.0, 5.2);
        ctx.stroke();

        cachedPngDataUrl = canvas.toDataURL('image/png');
        return cachedPngDataUrl;
      }
    } catch (e) {
      console.warn('Canvas rendering fallback:', e);
    }
  }

  // Fallback to SVG data URI if canvas is unavailable
  return `data:image/svg+xml;utf8,${encodeURIComponent(JDG_LOGO_SVG)}`;
}

/**
 * Draws the JDG TELECO corporate logo onto a jsPDF document in the top-left corner.
 * Works seamlessly in both Landscape and Portrait layouts.
 */
export function drawPdfHeaderLogo(
  pageDoc: jsPDF,
  options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    isLandscape?: boolean;
  } = {}
) {
  const isLandscape = options.isLandscape ?? true;
  const x = options.x ?? 14;
  const y = options.y ?? 7;
  // Default dimensions matching aspect ratio 2.8:1
  const width = options.width ?? (isLandscape ? 56 : 48);
  const height = options.height ?? (isLandscape ? 20 : 17.14);

  try {
    const logoUrl = getJdgLogoPngUrl();
    pageDoc.addImage(logoUrl, 'PNG', x, y, width, height);
  } catch (e) {
    console.warn('Could not add image directly to jsPDF, drawing vector fallback', e);
    // Vector fallback if addImage fails
    pageDoc.setFont('helvetica', 'bold');
    pageDoc.setFontSize(26);
    pageDoc.setTextColor(158, 200, 44); // Lime
    pageDoc.text('J', x, y + 15);
    pageDoc.setTextColor(0, 120, 122); // Teal
    pageDoc.text('DG', x + 7, y + 15);
    pageDoc.setFillColor(0, 120, 122);
    pageDoc.rect(x + 7, y + 17, 36, 5, 'F');
    pageDoc.setFont('courier', 'bold');
    pageDoc.setFontSize(8);
    pageDoc.setTextColor(255, 255, 255);
    pageDoc.text('TELECO', x + 25, y + 20.5, { align: 'center' });
  }
}
