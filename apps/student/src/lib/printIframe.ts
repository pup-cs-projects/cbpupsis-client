/**
 * Prints a standalone HTML document without leaving the current page: writes it into a hidden
 * iframe, waits for that document to finish loading (so its fonts and images are ready), then
 * opens the browser's print dialog against it. The iframe never gets a `src`, so this is a
 * same-origin document the whole time — no cross-origin restriction on reading `contentWindow`.
 */
export function printDocumentInHiddenIframe(htmlContent: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "display:none; position:fixed; right:0; bottom:0; width:0; height:0; border:0;";
    iframe.setAttribute("aria-hidden", "true");

    let settled = false;
    function cleanup() {
      iframe.remove();
    }
    function settle(action: () => void) {
      if (settled) return;
      settled = true;
      action();
    }

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        settle(() => {
          cleanup();
          reject(new Error("Could not open the print window."));
        });
        return;
      }
      // The print call resolves this promise once it returns; most browsers block here until
      // the print dialog closes, so by the time we get here the dialog has already been shown.
      win.focus();
      win.print();
      settle(resolve);
      // `afterprint` is the correct signal that the dialog is gone, for the browsers where
      // print() does not block. A fallback timer covers one that never fires it at all.
      win.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 60_000);
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      settle(() => {
        cleanup();
        reject(new Error("Could not open the print window."));
      });
      return;
    }
    doc.open();
    doc.write(htmlContent);
    doc.close();
  });
}
