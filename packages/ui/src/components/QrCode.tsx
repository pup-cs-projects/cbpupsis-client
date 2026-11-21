import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** A QR code for an `otpauth://` URI. Renders nothing until ready, or if it cannot be drawn. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(value, { margin: 1, width: 200 })
      .then((url) => current && setSrc(url))
      // The setup key beside it still works without the image.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [value]);

  return src ? <img className="setup-qr" src={src} width={200} height={200} alt={label} /> : null;
}
