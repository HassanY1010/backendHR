/**
 * Simple magic bytes checker to verify file types before processing.
 * Prevents malicious uploads disguised with wrong extensions.
 */

export const getMimeTypeFromBuffer = (buffer) => {
    if (!buffer || buffer.length < 4) return null;

    const bytes = [];
    buffer.forEach((byte) => bytes.push(byte.toString(16)));
    const hex = bytes.join('').toUpperCase();

    if (hex.startsWith('25504446')) return 'application/pdf';
    if (hex.startsWith('504B0304')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; // DOCX (zip)
    if (hex.startsWith('D0CF11E0')) return 'application/msword'; // DOC (Legacy)

    return 'unknown';
};

export const isAllowedCV = (buffer) => {
    const mime = getMimeTypeFromBuffer(buffer);
    return ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'].includes(mime);
};
