# Heze AI — Tam Pulsuz Versiya (OpenRouter ilə)

## Nə dəyişdi

- **Claude API əvəzinə OpenRouter API** — tam pulsuzdur, kredit kartı tələb etmir,
  gündə 50-200 sorğu limiti var (adi şəxsi istifadə üçün kifayətdir).
- Model: `meta-llama/llama-3.3-70b-instruct:free` — sürətli, keyfiyyətli açıq mənbəli model.
- Backend, qərəzsiz sistem promptu və mobil dizayn olduğu kimi qalıb.

## Addım-addım: sıfırdan işə salmaq

### 1. Pulsuz OpenRouter açarı alın (1 dəqiqə, kart lazım deyil)

1. https://openrouter.ai adresinə gedin
2. Email və ya Google hesabı ilə qeydiyyatdan keçin
3. Sol menyudan **API Keys** → **Create API Key**
4. Açarı kopyalayın (`sk-or-v1-...` ilə başlayır)

### 2. Render.com-da pulsuz deploy edin (mobil üçün lazımdır)

1. https://render.com — GitHub hesabınızla qeydiyyatdan keçin
2. **New +** → **Web Service**
3. GitHub reponuzu seçin
4. Bu parametrləri doldurun:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. **Environment Variables** bölməsinə əlavə edin:
   - Key: `OPENROUTER_API_KEY`  Value: (öz OpenRouter açarınız)
6. **Create Web Service** düyməsinə basın

2-3 dəqiqəyə sayt hazır olacaq, Render sizə bir link verəcək
(məs. `https://heze-ai.onrender.com`) — bunu **telefonunuzda** açsanız,
tətbiq işləyəcək.

⚠️ **Qeyd:** Render-in pulsuz tarifi 15 dəqiqə istifadə olunmadıqda "yatır" —
sonra ilk sorğuda 30-50 saniyə oyanma vaxtı ola bilər. Bu normaldır.

## Fayl strukturu

```
heze-ai/
├── server.js          ← backend (OpenRouter açarını gizli saxlayır)
├── package.json
├── .env.example         ← nümunə
├── .gitignore
└── public/
    └── index.html        ← frontend
```
