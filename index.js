const express = require('express');
const fetch = require('node-fetch');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

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

app.get('/', (req, res) => res.send('Proxy OK'));

// ── HTTP server + WebSocket server for DA relay ──
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/da-relay' });

// Store connected stream clients
const streamClients = new Set();

wss.on('connection', (ws) => {
  console.log('Stream client connected');
  streamClients.add(ws);
  ws.on('close', () => streamClients.delete(ws));
});

function broadcastDonation(data) {
  const msg = JSON.stringify({ type: 'donation', data });
  streamClients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

// ── Connect to DonationAlerts from server side ──
async function connectDA() {
  try {
    // Get user info and socket token
    const userResp = await fetch('https://www.donationalerts.com/api/v1/user/oauth', {
      headers: { 'Authorization': `Bearer ${DA_TOKEN}` }
    });
    const user = await userResp.json();
    const userId = user.data && user.data.id;
    const socketToken = user.data && user.data.socket_connection_token;
    if (!socketToken) { console.error('DA: no socket token'); setTimeout(connectDA, 15000); return; }

    // Get centrifuge channel token
    const subResp = await fetch('https://www.donationalerts.com/api/v1/centrifuge/subscribe', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: [`$alerts:donation_${userId}`] })
    });
    const subData = await subResp.json();
    const channels = subData.channels || [];

    // Connect to centrifuge WS
    const daWS = new WebSocket('wss://centrifugo.donationalerts.com/connection/websocket');

    daWS.on('open', () => {
      console.log('DA centrifuge connected');
      daWS.send(JSON.stringify({ params: { token: socketToken }, id: 1 }));
    });

    daWS.on('message', (raw) => {
      const data = JSON.parse(raw);
      // Subscribe to channel after connect
      if (data.id === 1 && data.result) {
        channels.forEach((ch, i) => {
          daWS.send(JSON.stringify({ method: 1, params: { channel: ch.channel, token: ch.token }, id: 2 + i }));
        });
      }
      // Relay donation to stream clients
      if (data.result && data.result.data && data.result.data.data) {
        const donation = data.result.data.data;
        console.log('Donation:', donation.username, donation.amount, donation.currency);
        broadcastDonation(donation);
      }
    });

    daWS.on('close', () => { console.log('DA disconnected, reconnecting...'); setTimeout(connectDA, 5000); });
    daWS.on('error', (e) => console.error('DA error:', e.message));

  } catch(e) {
    console.error('DA connection failed:', e.message);
    setTimeout(connectDA, 15000);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  connectDA();
});
