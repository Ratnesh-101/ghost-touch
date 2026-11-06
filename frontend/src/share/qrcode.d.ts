declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    width?: number;
    scale?: number;
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;

  const qrcode: {
    toDataURL(
      text: string,
      options?: QRCodeToDataURLOptions,
    ): Promise<string>;
  };

  export default qrcode;
}
