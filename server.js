require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;

const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-20b:free',
  'openrouter/free'
];

app.use(express.json({ limit: '5mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const SYSTEM_PROMPT = `Sən Heze AI-sən — dərin, dəqiq və faydalı cavablar verən ağıllı bir köməkçisən.
- İstifadəçi hansı dildə yazırsa sən də HƏMİN dildə cavab ver.
- Sualları tam anla, lazım gələndə addım-addım izah et.
- Proqramlaşdırma sualı verilibsə, işlək, şərhli kod yaz.
- Cavablarını aydın formatla — başlıqlar, siyahılar, kod blokları lazım gəldikcə istifadə et.
- Əmin olmadığın məlumatı qəti kimi təqdim etmə.`;

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) return res.status(500).json({ error: 'API açarı yoxdur.' });

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'Mesaj yoxdur.' });

    const cleanMessages = messages
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let success = false;
    for (const model of MODELS) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            stream: true,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...cleanMessages]
          })
        });

        if (!response.ok) { const e = await response.json(); console.error(model, e?.error?.message); continue; }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n').filter(l => l.startsWith('data:'))) {
            const raw = line.slice(5).trim();
            if (!raw || raw === '[DONE]') continue;
            try {
              const text = JSON.parse(raw)?.choices?.[0]?.delta?.content || '';
              if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
            } catch (_) {}
          }
        }
        success = true;
        break;
      } catch (e) { console.error(model, e.message); }
    }

    if (!success) res.write(`data: ${JSON.stringify({ error: 'Bütün modellər uğursuz oldu.' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Server xətası.' });
    else { res.write(`data: ${JSON.stringify({ error: 'Server xətası.' })}\n\n`); res.end(); }
  }
});

app.listen(PORT, () => console.log(`Heze AI server http://localhost:${PORT}`));
