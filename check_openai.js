import https from 'https';
import fs from 'fs';
import path from 'fs';
import { fileURLToPath } from 'url';

// Simple script to check OpenAI API Key balance/validity
const envContent = fs.readFileSync('.env', 'utf8');
const apiKeyMatch = envContent.match(/OPENAI_API_KEY="(.+)"/);
const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in .env');
    process.exit(1);
}

const data = JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'hi' }],
    max_tokens: 5
});

const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
    }
};

console.log('🔄 Checking OpenAI API Key...');

const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (d) => {
        responseBody += d;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Success! The key is valid and has balance.');
        } else {
            console.log(`❌ Error: Status Code ${res.statusCode}`);
            try {
                const error = JSON.parse(responseBody);
                console.log('Message:', error.error?.message || 'Unknown error');
                if (error.error?.code === 'insufficient_quota') {
                    console.log('⚠️ Result: The key has NO balance (Quota Exceeded).');
                } else if (error.error?.code === 'invalid_api_key') {
                    console.log('⚠️ Result: The key is INVALID.');
                }
            } catch (e) {
                console.log('Raw Response:', responseBody);
            }
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Connection Error:', error.message);
});

req.write(data);
req.end();
