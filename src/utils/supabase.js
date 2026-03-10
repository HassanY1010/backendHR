import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;

// We prioritize the SERVICE_ROLE_KEY to bypass Row-Level Security (RLS) on server-side uploads.
// If the SERVICE_ROLE_KEY is not available, we fall back to the ANON_KEY, which might fail if 
// the Supabase bucket is not configured for public/anonymous uploads.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Ensure we don't throw immediately on import if env vars are missing, 
// so the app can start but we throw later if we actually try to upload without them configured.
export const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

/**
 * Uploads a file buffer to Supabase Storage
 * @param {Buffer} fileBuffer - The buffer of the file to upload
 * @param {string} fileName - The name/path of the file in the bucket (e.g., 'resumes/123-file.pdf')
 * @param {string} mimetype - The mime type of the file
 * @returns {Promise<string>} - The public URL of the uploaded file
 */
export const uploadFileToSupabase = async (fileBuffer, fileName, mimetype) => {
    if (!supabase) {
        throw new Error('Supabase client is not initialized. Check your environment variables.');
    }

    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, fileBuffer, {
            contentType: mimetype,
            upsert: true,
        });

    if (error) {
        throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
};
