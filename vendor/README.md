# Vendored libraries (PDF Studio)

Pinned copies of the third-party scripts PDF Studio loads, so the page makes no
third-party script requests and works offline after the first visit.

| File | Library | Version | License |
|---|---|---|---|
| pdf-lib.min.js | pdf-lib | 1.17.1 | MIT |
| pdf.min.js, pdf.worker.min.js | pdf.js | 3.11.174 | Apache-2.0 |
| mammoth.browser.min.js | mammoth | 1.6.0 | BSD-2-Clause |
| xlsx.full.min.js | SheetJS (xlsx) | 0.18.5 | Apache-2.0 |
| jszip.min.js | JSZip | 3.10.1 | MIT / GPL-3.0 |
| jspdf.umd.min.js | jsPDF | 2.5.1 | MIT |
| html2canvas.min.js | html2canvas | 1.4.1 | MIT |
| docx-preview.min.js | docx-preview | 0.3.7 | Apache-2.0 |

Sources: cdnjs.cloudflare.com (all but docx-preview) and unpkg.com (docx-preview).
Load JSZip before docx-preview.
