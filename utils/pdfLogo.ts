import { jsPDF } from 'jspdf';
import { JDG_LOGO_BASE64 } from './logoBase64';

export const LOGO_URL = "/logo.png";
export const LOGO_FALLBACK_URL = "https://res.cloudinary.com/cmny1t9m/image/upload/v1789807753/logo%20new.png";

/**
 * Returns a high-resolution PNG data URL of the official JDG TELECO logo.
 */
export function getJdgLogoPngUrl(): string {
  return JDG_LOGO_BASE64;
}

/**
 * Draws the official JDG TELECO corporate logo onto a jsPDF document in the header.
 * Maintains the exact aspect ratio (1024x402 -> 2.547:1) so the logo is rendered crisp and undistorted.
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
  const x = options.x ?? (isLandscape ? 15 : 14);
  const y = options.y ?? 7;

  // Exact aspect ratio of official logo: 1024 x 402 = 2.54726
  const aspectRatio = 1024 / 402;

  let width = options.width ?? (isLandscape ? 51 : 48);
  let height = options.height ?? (width / aspectRatio);

  // Preserve proportional aspect ratio if both width and height are provided
  if (options.width && options.height) {
    const boxAspect = options.width / options.height;
    if (boxAspect > aspectRatio) {
      height = options.height;
      width = height * aspectRatio;
    } else {
      width = options.width;
      height = width / aspectRatio;
    }
  }

  try {
    pageDoc.addImage(JDG_LOGO_BASE64, 'PNG', x, y, width, height);
  } catch (e) {
    console.warn('Could not add logo image to jsPDF', e);
  }
}
