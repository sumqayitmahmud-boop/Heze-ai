// Heze AI - Backend Proxy Server
// Bu server API açarını GİZLİ saxlayır (client-side kodda API açarı OLMAZ).
// Frontend yalnız /api/chat endpointinə mesaj göndərir, server isə
// OpenRouter API-yə (TAM PULSUZ modellər, email ilə qeydiyyat) açarla müraciət edir.
// Açar buradan alınır: https://openrouter.ai/keys

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

if (!API_KEY) {
  console.error('XƏTA: .env faylında OPENROUTER_API_KEY tapılmadı!');
  console.error('Zəhmət olmasa .env.example-i .env kimi kopyalayıb açarınızı yazın.');
  console.error('Açarı buradan pulsuz alın: https://openrouter.ai/keys');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Sistemin dürüst, qərəzsiz təlimatı (server-side saxlanır ki, kimsə
// brauzerin developer console-undan görüb dəyişə bilməsin)
const SYSTEM_PROMPT = `İstifadəçi hansı dildə yazırsa sən də HƏMİN dildə cavab ver
(Azərbaycan dilində yazılıbsa, Azərbaycan dilində cavab ver).
Proqramlaşdırma sualı verilibsə, düzgün, işlək kod ilə və qısa izahla cavab ver.
Cavablarını aydın və səliqəli formatla, lazım gəldikdə markdown və kod blokları istifadə et.
Suallara dürüst, obyektiv və balanslaşdırılmış şəkildə cavab ver.`;

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'Server tərəfində API açarı konfiqurasiya olunmayıb.' });
    }

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesajlar göndərilməyib.' });
    }

    const cleanMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    const openrouterMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...cleanMessages
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: openrouterMessages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter API xətası:', data);
      return res.status(response.status).json({
        error: data?.error?.message || 'API sorğusu uğursuz oldu.'
      });
    }

    const reply = data?.choices?.[0]?.message?.content || 'Cavab alınmadı.';

    res.json({ reply });

  } catch (err) {
    console.error('Server xətası:', err);
    res.status(500).json({ error: 'Server xətası baş verdi.' });
  }
});

app.listen(PORT, () => {
  console.log(`Heze AI server http://localhost:${PORT} ünvanında işləyir`);
});
