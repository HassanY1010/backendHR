import http from 'https';

console.log('🔍 Testing live Render endpoint: https://backendhr-ovjw.onrender.com/api/recruitment/interviews');

http.get('https://backendhr-ovjw.onrender.com/api/recruitment/interviews', (res) => {
    console.log(`STATUS CODE: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('RESPONSE:', data.substring(0, 300));
    });
}).on('error', (err) => {
    console.error('ERROR:', err.message);
});
