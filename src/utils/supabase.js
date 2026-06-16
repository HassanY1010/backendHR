import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

const uploadsDir = path.join(__dirname, '../../uploads');

/**
 * Uploads a file buffer to Supabase Storage, with local filesystem fallback.
 * @param {Buffer} fileBuffer - The buffer of the file to upload
 * @param {string} fileName - The name/path of the file in the bucket (e.g., 'resumes/123-file.pdf')
 * @param {string} mimetype - The mime type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadFileToSupabase = async (fileBuffer, fileName, mimetype) => {
    if (supabase) {
        try {
            const { data, error } = await supabase.storage
                .from('uploads')
                .upload(fileName, fileBuffer, {
                    contentType: mimetype,
                    upsert: true,
                });

            if (error) throw new Error(error.message);

            const { data: publicUrlData } = supabase.storage
                .from('uploads')
                .getPublicUrl(fileName);

            return publicUrlData.publicUrl;
        } catch (error) {
            logger.error('Supabase upload failed, falling back to local storage', { error: error.message });
        }
    }

    // Fallback: save to local filesystem
    const localPath = path.join(uploadsDir, fileName);
    const localDir = path.dirname(localPath);

    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localPath, fileBuffer);

    const localUrl = `/uploads/${fileName}`;
    logger.info('File saved locally', { path: localUrl });

    return localUrl;
};
