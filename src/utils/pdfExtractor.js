import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const standardFontDataUrl = path.join(
    __dirname,
    "../../../../node_modules/pdfjs-dist/standard_fonts/"
) + "/";

/**
 * Extracts text from a PDF buffer using pdfjs-dist (Legacy build for Node.js).
 * @param {Buffer} buffer - The PDF file buffer.
 * @returns {Promise<string>} - The extracted text.
 */
export const extractTextFromPDF = async (buffer) => {
    // Convert Node Buffer to Uint8Array
    const uint8Array = new Uint8Array(buffer);

    // Load the document
    const loadingTask = pdfjsLib.getDocument({
        data: uint8Array,
        standardFontDataUrl,
        // Disable worker for Node.js environment usually usually avoids needing worker files
        disableFontFace: true,
    });

    const pdf = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        // Basic extraction: join items with space
        // Optional: Sort by Y position for better line reading if needed
        // const pageText = content.items
        //   .sort((a, b) => b.transform[5] - a.transform[5]) 
        //   .map(item => item.str)
        //   .join(" ");

        const pageText = content.items
            .map(item => item.str)
            .join(" ");

        fullText += pageText + "\n";
    }

    return fullText;
};
