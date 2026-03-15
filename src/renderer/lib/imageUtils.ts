/**
 * Decode ROS image messages (base64 or uint8[] in JSON).
 */

export interface CompressedImageMsg {
  format?: string;
  data?: string | number[];
}

export interface ImageMsg {
  height?: number;
  width?: number;
  encoding?: string;
  step?: number;
  data?: string | number[];
}

/** Build data URL for CompressedImage (jpeg/png). */
export function compressedImageToDataUrl(msg: CompressedImageMsg): string | null {
  const data = msg?.data;
  if (data == null) return null;

  const format = (msg.format ?? 'jpeg').toLowerCase().replace('jpg', 'jpeg');
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';

  if (typeof data === 'string') {
    return `data:${mime};base64,${data}`;
  }
  if (Array.isArray(data)) {
    const bytes = new Uint8Array(data);
    const b64 = btoa(String.fromCharCode(...bytes));
    return `data:${mime};base64,${b64}`;
  }
  return null;
}

/** Decode raw Image (sensor_msgs/Image) to ImageData for canvas. */
function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function arrayToUint8Array(arr: number[]): Uint8Array {
  return new Uint8Array(arr);
}

export function rawImageToImageData(msg: ImageMsg): ImageData | null {
  const { height = 0, width = 0, encoding = 'rgb8', data } = msg;
  if (!data || width <= 0 || height <= 0) return null;

  const raw =
    typeof data === 'string' ? base64ToUint8Array(data) : arrayToUint8Array(data as number[]);

  const imageData = new ImageData(width, height);
  const enc = (encoding ?? 'rgb8').toLowerCase();

  if (enc === 'rgb8' || enc === 'rgba8') {
    const bpp = enc === 'rgba8' ? 4 : 3;
    for (let i = 0; i < width * height; i++) {
      imageData.data[i * 4] = raw[i * bpp] ?? 0;
      imageData.data[i * 4 + 1] = raw[i * bpp + 1] ?? 0;
      imageData.data[i * 4 + 2] = raw[i * bpp + 2] ?? 0;
      imageData.data[i * 4 + 3] = bpp === 4 ? (raw[i * 4 + 3] ?? 255) : 255;
    }
  } else if (enc === 'bgr8' || enc === 'bgra8') {
    const bpp = enc === 'bgra8' ? 4 : 3;
    for (let i = 0; i < width * height; i++) {
      imageData.data[i * 4] = raw[i * bpp + 2] ?? 0;
      imageData.data[i * 4 + 1] = raw[i * bpp + 1] ?? 0;
      imageData.data[i * 4 + 2] = raw[i * bpp] ?? 0;
      imageData.data[i * 4 + 3] = bpp === 4 ? (raw[i * 4 + 3] ?? 255) : 255;
    }
  } else {
    return null;
  }

  return imageData;
}
