import type { TotpSetup as Setup } from "@cbpupsis/shared/auth";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** The QR code and the typed-in fallback for adding the account to an authenticator app. */
export function TotpSetup({ setup }: { setup: Setup }) {
  const [qr, setQr] = useState<string>();

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(setup.uri, { margin: 1, width: 200 })
      .then((url) => current && setQr(url))
      // The setup key below still works without the image.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [setup.uri]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-gray-700">
        Scan this code with your authenticator app, or enter the setup key by hand.
      </p>
      {qr && (
        <img
          src={qr}
          width={200}
          height={200}
          alt={`QR code to add ${setup.accountName} to an authenticator app`}
          className="self-center rounded-md border border-gray-200"
        />
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="setup-key" className="font-medium text-gray-900">
          Setup key
        </label>
        <input
          id="setup-key"
          readOnly
          value={setup.secret}
          spellCheck={false}
          autoComplete="off"
          className="min-h-11 rounded-md border border-gray-400 bg-gray-50 px-3 font-mono text-base break-all"
        />
        <p className="text-sm text-gray-600">
          Account: {setup.accountName}
          {setup.issuer && <> · Issuer: {setup.issuer}</>}
        </p>
      </div>
    </div>
  );
}
