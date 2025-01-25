const hexTable = new TextEncoder().encode("0123456789abcdef");
export function encode(src: Uint8Array): Uint8Array {
    const dst = new Uint8Array(src.length * 2);
    for (let i = 0; i < dst.length; i++) {
      const v = src[i];
      dst[i * 2] = hexTable[v >> 4];
      dst[i * 2 + 1] = hexTable[v & 0x0f];
    }
    return dst;
  }