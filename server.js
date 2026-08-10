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

if (!API_KEY) {
  console.error('XƏTA: OPENROUTER_API_KEY tapılmadı!');
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
- İstifadəçi hansı dildə yazırsa sən də HƏMİN dildə cavab ver (Azərbaycan dilində yazılıbsa, Azərbaycan dilində cavab ver).
- Sualları səthi keçmə — mövzunu tam anla, lazım gələndə addım-addım izah et, konkret nümunələr göstər.
- Proqramlaşdırma sualı verilibsə, düzgün, işlək, şərhli kod yaz və qısa izahla müşayiət et.
- Mürəkkəb sualları kiçik hissələrə bölərək, məntiqli ardıcıllıqla cavabla.
- Cavablarını aydın və səliqəli formatla — başlıqlar, siyahılar, kod blokları lazım gəldikcə istifadə et, amma süni şəkildə uzatma.
- Əmin olmadığın məlumatı qəti kimi təqdim etmə, şübhəni bildir.
- Suallara dürüst, obyektiv və balanslaşdırılmış şəkildə cavab ver, qərəzli mövqe tutma.`;

// Mesajları hazırla — şəkil dəstəyi ilə
function buildMessages(messages) {
  const result = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;

    // Şəkil varsa array content istifadə et
    if (m.role === 'user' && Array.isArray(m.content)) {
      const parts = [];
      for (const part of m.content) {
        if (part.type === 'text') {
          parts.push({ type: 'text', text: part.text || '' });
        } else if (part.type === 'image') {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${part.source.media_type};base64,${part.source.data}`
            }
          });
        }
      }
      result.push({ role: 'user', content: parts });
    } else {
      result.push({ role: m.role, content: typeof m.content === 'string' ? m.content : '' });
    }
  }

  return result;
}

app.post('/api/chat', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'API açarı konfiqurasiya olunmayıb.' });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Mesajlar göndərilməyib.' });
    }

    const openrouterMessages = buildMessages(messages);

    // SSE streaming başlat
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
            messages: openrouterMessages
          })
        });

        if (!response.ok) {
          const err = await response.json();
          console.error(`Model ${model} uğursuz:`, err?.error?.message);
          continue;
        }

        // Stream oxu və clientə göndər
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(l => l.startsWith('data:'));

          for (const line of lines) {
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const obj = JSON.parse(raw);
              const text = obj.choices?.[0]?.delta?.content || '';
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
              }
            } catch (_) {}
          }
        }

        success = true;
        break;

      } catch (err) {
        console.error(`Model ${model} xətası:`, err.message);
      }
    }

    if (!success) {
      res.write(`data: ${JSON.stringify({ error: 'Bütün modellər uğursuz oldu.' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Server xətası:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Server xətası baş verdi.' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Server xətası.' })}\n\n`);
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Heze AI server http://localhost:${PORT} ünvanında işləyir`);
});
