import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

function waitForImages(doc: Document): Promise<void> {
  return Promise.all(
    [...doc.images].map((image) => {
      if (image.complete) {
        return image.naturalWidth > 0
          ? Promise.resolve()
          : Promise.reject(new Error("The certificate logo could not be loaded."));
      }
      return new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error("The certificate logo could not be loaded.")),
          { once: true },
        );
      });
    }),
  ).then(() => undefined);
}

/** Renders the standalone COR HTML to a direct A4-landscape file download. The transient iframe
 * gives html2canvas an isolated, fixed-size document without opening the browser print dialog. */
export async function downloadCertificatePdf(html: string, filename: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed; left:-10000px; top:0; width:281mm; height:194mm; border:0; visibility:hidden;";

  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Could not prepare the certificate document.");

    doc.open();
    doc.write(html);
    doc.close();
    await waitForImages(doc);

    const canvas = await html2canvas(doc.body, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: doc.body.scrollWidth,
      windowHeight: doc.body.scrollHeight,
    });
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 8, 8, 281, 194, undefined, "FAST");
    pdf.save(filename);
  } finally {
    iframe.remove();
  }
}
