const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// CORS — allow everything
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const FISH_API_KEY = 'ddaea452e2ad4180b301ccbb5479aeaa';
const DA_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxODcxMSIsImp0aSI6ImJhYTUzZDNhMjFjNTZiOGFmMjQ2NmZlZTUzMDg5ZWZlYzA5ZmZhN2M1YTc3MDJiNTU4MGMxYTljN2Q3ODljYjJlZjQ1YWE3ZmNhOTdiODAwIiwiaWF0IjoxNzc3MTI4MDQ4LjM5NjMsIm5iZiI6MTc3NzEyODA0OC4zOTYzLCJleHAiOjE4MDg2NjQwNDguMzg4MSwic3ViIjoiMTU0NTMzMzYiLCJzY29wZXMiOlsib2F1dGgtZG9uYXRpb24tc3Vic2NyaWJlIl19.PuwMlRIZUZrzp9p3b9DPakCXeqSCbzRD9zgn7FFwm3G6ICT1Jo0XUP8qLfKUNXHbDisB0pzROvtcE5ohfAP0Wuc7l3BCXNwYIU8m3vR9FO0Dzk4AbOS2TjQUj_qNDgFNEAK-XsVjXDSNqWhLt8H9p9nVpN2eLuTpHv-VdhDsG-wOkjk9iNM1Piebk9KhQCjmHkPuYI7xtJcZX6rob0tTfyZ87jkSysiDcGveXoU0Xu1_p-KX2xj5ZGYFn-KHQs32TMPVzcWE_8V7QACPBLjFexEbPJ9KiEB262ZFOg9COy38Pw0VQf9F7nBaFTKu6FnssIsAy2XJwiAwCRizSaz_NzaoaQUa_FS35SBU16D5XL4fxzXJz5xJiUE_GoMnLkkWHSqZkVXNKuZhGJJO3UA_cJ2jycWI4g8lPORbOGe8Tz1FM1midbYY2UUuVSoxvcNY6sErvooVlNjL-ycN88rUXSM5i-2ZuoCeXF9qkIbtOkEssKeKX5V0ZdI7XKDGKSn1QY3AxyGjhjLu7xSWXtZ9ZI0sRj8Vm5zFsIJd0lOE0A7CEKh7pS4BtB1NasK5vNwtZVJpHW06yzrRK2WeQ7uHFZKzRXNRDE_KsoBMiGn1lYA6jg5bnvXTPlUb5MfyAb5yKYUYcrClJqx-MlbKmd0q22gFRJmNJYf8AqftnQU46nQ';

// ── TTS proxy ──
app.post('/tts', async (req, res) => {
  try {
    const { text, reference_id } = req.body;
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, reference_id, format: 'mp3', mp3_bitrate: 64 })
    });
    if (!response.ok) return res.status(response.status).json({ error: 'Fish Audio error: ' + response.status });
    const buffer = await response.buffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DonationAlerts user proxy ──
app.get('/da/user', async (req, res) => {
  try {
    const response = await fetch('https://www.donationalerts.com/api/v1/user/oauth', {
      headers: { 'Authorization': `Bearer ${DA_TOKEN}` }
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DonationAlerts centrifuge subscribe proxy ──
app.post('/da/subscribe', async (req, res) => {
  try {
    const response = await fetch('https://www.donationalerts.com/api/v1/centrifuge/subscribe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send('Proxy OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
