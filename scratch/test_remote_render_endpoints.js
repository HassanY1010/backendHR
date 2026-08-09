import http from 'https';

function checkUrl(url) {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data.substring(0, 200) }));
        }).on('error', err => resolve({ status: 'ERR', error: err.message }));
    });
}

async function run() {
    console.log('📡 Testing Render Live Endpoints...');
    const jobsRes = await checkUrl('https://backendhr-ovjw.onrender.com/api/recruitment/jobs');
    console.log('GET /jobs STATUS:', jobsRes.status, 'BODY:', jobsRes.body);

    const interviewsRes = await checkUrl('https://backendhr-ovjw.onrender.com/api/recruitment/interviews');
    console.log('GET /interviews STATUS:', interviewsRes.status, 'BODY:', interviewsRes.body);
}

run();
