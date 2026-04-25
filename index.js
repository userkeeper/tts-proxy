const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Allow all origins (CORS)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const FISH_API_KEY = 'ddaea452e2ad4180b301ccbb5479aeaa';

app.post('/tts', async (req, res) => {
  try {
    const { text, reference_id } = req.body;
    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FISH_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        reference_id,
        format: 'mp3',
        mp3_bitrate: 64,
      })
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Fish Audio error' });
    }
    const buffer = await response.buffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/', (req, res) => res.send('TTS Proxy OK'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TTS proxy running on port ${PORT}`));
