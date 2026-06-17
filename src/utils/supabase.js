import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET || 'uploads';

if (!supabaseUrl || !supabaseKey) {
    logger.warn('⚠️  Supabase credentials are NOT configured. File uploads will fall back to local storage (ephemeral on Render!).');
    logger.warn('   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables.');
} else {
    logger.info(`✅ Supabase configured: URL=${supabaseUrl}, bucket=${bucketName}, key type=${supabaseKey.startsWith('sb_publishable_') ? 'anon/publishable' : 'service_role JWT'}`);
}

const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    })
    : null;

const uploadsDir = path.join(__dirname, '../../uploads');

/**
 * Ensures the Supabase storage bucket exists and is public.
 * Only works with service_role key.
 */
const ensureBucket = async () => {
    if (!supabase) return;

    // Anon/publishable keys cannot manage buckets
    if (supabaseKey && supabaseKey.startsWith('sb_publishable_')) {
        logger.warn('Using anon/publishable key — skipping bucket creation. Make sure the bucket exists in Supabase dashboard.');
        return;
    }

    try {
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        if (listError) {
            logger.warn(`Could not list buckets: ${listError.message}`);
            return;
        }

        const exists = buckets?.some(b => b.name === bucketName);
        if (!exists) {
            logger.info(`Bucket "${bucketName}" not found — creating it...`);
            const { error: createError } = await supabase.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 50 * 1024 * 1024, // 50 MB
            });
            if (createError) {
                logger.warn(`Failed to create bucket "${bucketName}": ${createError.message}`);
            } else {
                logger.info(`✅ Bucket "${bucketName}" created successfully.`);
            }
        } else {
            logger.info(`✅ Bucket "${bucketName}" already exists.`);
        }
    } catch (err) {
        logger.warn('Error during bucket setup:', err?.message || err);
    }
};

// Ensure bucket on startup
ensureBucket();

/**
 * Uploads a file buffer to Supabase Storage, with local filesystem fallback.
 * @param {Buffer} fileBuffer - The buffer of the file to upload
 * @param {string} fileName - The name/path of the file in the bucket (e.g., 'avatars/123-file.jpg')
 * @param {string} mimetype - The mime type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadFileToSupabase = async (fileBuffer, fileName, mimetype) => {
    if (supabase) {
        try {
            logger.info(`Uploading to Supabase: bucket="${bucketName}", file="${fileName}"`);

            const { data, error } = await supabase.storage
                .from(bucketName)
                .upload(fileName, fileBuffer, {
                    contentType: mimetype,
                    upsert: true,
                });

            if (error) {
                throw new Error(`Supabase upload error: ${error.message}`);
            }

            const { data: publicUrlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(fileName);

            logger.info(`✅ File uploaded to Supabase: ${publicUrlData.publicUrl}`);
            return publicUrlData.publicUrl;
        } catch (error) {
            logger.error(`❌ Supabase upload FAILED for "${fileName}": ${error.message}`);
            logger.error('   Falling back to local storage. This URL will break after Render restarts!');
        }
    } else {
        logger.warn('Supabase client not initialized — using local storage fallback.');
    }

    // ─── Fallback: local filesystem ────────────────────────────────────────────
    // WARNING: Local files are lost on Render restarts/deploys!
    const localPath = path.join(uploadsDir, fileName);
    const localDir = path.dirname(localPath);

    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localPath, fileBuffer);

    const localUrl = `/uploads/${fileName}`;
    logger.warn(`File saved LOCALLY (ephemeral!): ${localUrl}`);
    return localUrl;
};

/**
 * Deletes a file from Supabase Storage by its path in the bucket.
 * @param {string} fileName - The path of the file in the bucket
 */
export const deleteFileFromSupabase = async (fileName) => {
    if (!supabase) return;
    try {
        const { error } = await supabase.storage.from(bucketName).remove([fileName]);
        if (error) logger.warn(`Failed to delete "${fileName}" from Supabase: ${error.message}`);
        else logger.info(`Deleted "${fileName}" from Supabase.`);
    } catch (err) {
        logger.warn(`Error deleting file from Supabase: ${err.message}`);
    }
};

/**
 * Health check: test if Supabase connection is working.
 * @returns {Promise<{ok: boolean, message: string}>}
 */
export const checkSupabaseHealth = async () => {
    if (!supabase) {
        return { ok: false, message: 'Supabase not configured (missing SUPABASE_URL or key)' };
    }
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) return { ok: false, message: error.message };
        const bucket = data?.find(b => b.name === bucketName);
        return {
            ok: true,
            message: `Connected. Bucket "${bucketName}": ${bucket ? '✅ exists' : '❌ NOT found'}`,
            buckets: data?.map(b => b.name),
        };
    } catch (err) {
        return { ok: false, message: err.message };
    }
};

export default supabase;
