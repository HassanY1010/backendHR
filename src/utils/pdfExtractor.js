import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const _require = createRequire(import.meta.url);

let standardFontDataUrl;
try {
    const pdfjsPath = path.dirname(_require.resolve('pdfjs-dist/package.json'));
    standardFontDataUrl = path.join(pdfjsPath, 'standard_fonts') + '/';
} catch (e) {
    standardFontDataUrl = path.join(__dirname, '../../node_modules/pdfjs-dist/standard_fonts/') + '/';
}

/**
 * Extracts text from a PDF buffer using pdfjs-dist (Legacy build for Node.js).
 * @param {Buffer} buffer - The PDF file buffer.
 * @returns {Promise<string>} - The extracted text.
 */
export const extractTextFromPDF = async (buffer) => {
    const uint8Array = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        standardFontDataUrl,
        disableFontFace: true,
        useSystemFonts: false,
        enableXfa: true,
    });

    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const pageText = content.items
                .map(item => item.str)
                .join(" ");
            fullText += pageText + "\n";
        } catch (pageError) {
            continue;
        }
    }

    return fullText;
};
