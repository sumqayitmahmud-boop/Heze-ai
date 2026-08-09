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
// Bir neçə ehtiyat model - biri pulsuz siyahıdan çıxarsa, növbəti avtomatik sınanır
const MODELS = [
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free'
];

if (!API_KEY) {
  console.error('XƏTA: .env faylında OPENROUTER_API_KEY tapılmadı!');
  console.error('Zəhmət olmasa .env.example-i .env kimi kopyalayıb açarınızı yazın.');
  console.error('Açarı buradan pulsuz alın: https://openrouter.ai/keys');
}

app.use(express.json());

// CORS - yerli fayldan (file://) və ya APK-dan açılan versiyanın da
// serverə sorğu göndərə bilməsi üçün icazə veririk
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
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

    // Modelləri sırayla sına - biri "unavailable" desə, növbətini cəhd et
    let data, response;
    let lastError = null;

    for (const model of MODELS) {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 8192,
          messages: openrouterMessages
        })
      });

      data = await response.json();

      if (response.ok) {
        break;
      }

      lastError = data;
      console.error(`Model ${model} uğursuz oldu, növbəti sınanır:`, data?.error?.message);
    }

    if (!response.ok) {
      console.error('Bütün modellər uğursuz oldu:', lastError);
      return res.status(response.status).json({
        error: lastError?.error?.message || 'API sorğusu uğursuz oldu.'
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
