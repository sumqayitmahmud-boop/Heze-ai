require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_KEY) {
  console.error('XƏTA: GEMINI_API_KEY tapılmadı!');
}

app.use(express.json({ limit: '20mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Sən Heze AI-sən — dərin, dəqiq və faydalı cavablar verən ağıllı bir köməkçisən.

Qaydalar:
- İstifadəçi hansı dildə yazırsa sən də HƏMİN dildə cavab ver.
- Sualları tam anla, lazım gələndə addım-addım izah et.
- Proqramlaşdırma sualı verilibsə, işlək, şərhli kod yaz.
- Cavablarını aydın formatla — başlıqlar, siyahılar, kod blokları lazım gəldikcə istifadə et.
- Əmin olmadığın məlumatı qəti kimi təqdim etmə.
- Şəkil göndərilibsə, onu diqqətlə analiz et və təsvir et.`;

function buildGeminiContents(messages) {
  const contents = [];

  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;

    const role = m.role === 'assistant' ? 'model' : 'user';

    // Şəkil var (array content)
    if (Array.isArray(m.content)) {
      const parts = [];
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ text: part.text || '' });
        } else if (part.type === 'image') {
          parts.push({
            inline_data: {
              mime_type: part.source.media_type,
              data: part.source.data
            }
          });
        }
      }
      contents.push({ role, parts });
    } else {
      contents.push({ role, parts: [{ text: m.content || '' }] });
    }
  }

  return contents;
}

app.post('/api/chat', async (req, res) => {
  try {
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: 'API açarı konfiqurasiya olunmayıb.' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesajlar göndərilməyib.' });
    }

    const contents = buildGeminiContents(messages);

    // SSE streaming başlat
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Gemini xətası:', err);
      res.write(`data: ${JSON.stringify({ error: err?.error?.message || 'API xətası' })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data:'));

      for (const line of lines) {
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const obj = JSON.parse(raw);
          const text = obj?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch (_) {}
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Server xətası:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server xətası.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Server xətası.' })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Heze AI (Gemini) server http://localhost:${PORT} ünvanında işləyir`);
});
