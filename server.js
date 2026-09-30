const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 3000;

/* =========================================================
   API KEYS
========================================================= */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PIXAZO_API_KEY = process.env.PIXAZO_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

/* =========================================================
   MODELS (تم تثبيت النماذج الصحيحة لتجاهل أخطاء الواجهة)
========================================================= */
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.0-flash-lite-001:free";

/* =========================================================
   HOME & HEALTH
========================================================= */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "ZAKA AI",
    message: "ZAKA AI Backend يعمل بنجاح 🚀"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    gemini: Boolean(GEMINI_API_KEY),
    openrouter: Boolean(OPENROUTER_API_KEY),
    pixazo: Boolean(PIXAZO_API_KEY),
    elevenlabs: Boolean(ELEVENLABS_API_KEY)
  });
});

/* =========================================================
   HELPER FUNCTIONS (AI PROVIDERS)
========================================================= */
async function fetchGemini(conversation, requestedModel) {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY غير موجود في البيئة");

  // إجبار الكود على استخدام النماذج المدعومة فقط وتجاهل gemini-3.8-flash أو أي اسم خاطئ
  const validModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
  const selectedModel = validModels.includes(requestedModel) ? requestedModel : DEFAULT_GEMINI_MODEL;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({ contents: conversation })
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Gemini HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data?.error;
    throw err;
  }

  const answer = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || "").join("").trim();
  if (!answer) throw new Error("Gemini لم يرجع نصًا");

  return { answer, model: selectedModel };
}

async function fetchOpenRouter(conversation, requestedModel) {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY غير موجود في البيئة");

  // التأكد من استخدام نموذج مجاني يعمل دائماً
  const selectedModel = (requestedModel && requestedModel.endsWith(":free") && requestedModel !== "openrouter/free") 
    ? requestedModel 
    : DEFAULT_OPENROUTER_MODEL;

  const openRouterMessages = conversation.map(item => ({
    role: item.role === "model" ? "assistant" : "user",
    content: item.parts?.map(part => part?.text || "").join("") || ""
  }));

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://zaka-ai-backend-1.onrender.com", 
      "X-Title": "ZAKA AI"
    },
    body: JSON.stringify({
      model: selectedModel,
      messages: openRouterMessages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenRouter HTTP ${response.status}`);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (!answer) throw new Error("OpenRouter لم يرجع نصًا");

  return { answer, model: selectedModel };
}

/* =========================================================
   CHAT API
========================================================= */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, messages, provider, model } = req.body;
    let conversation = [];

    // تنسيق الرسائل
    if (Array.isArray(messages) && messages.length > 0) {
      conversation = messages
        .filter(item => item && item.content)
        .map(item => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: String(item.content) }]
        }));
    } else if (typeof message === "string" && message.trim()) {
      conversation = [{ role: "user", parts: [{ text: message.trim() }] }];
    }

    if (conversation.length === 0) {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    // 1. إذا تم طلب OpenRouter صراحة
    if (provider === "openrouter") {
      try {
        const result = await fetchOpenRouter(conversation, model);
        return res.json({ reply: result.answer, answer: result.answer, provider: "openrouter", model: result.model });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 2. الطلب الافتراضي لـ Gemini مع التحويل التلقائي لـ OpenRouter
    try {
      const result = await fetchGemini(conversation, model);
      return res.json({ reply: result.answer, answer: result.answer, provider: "gemini", model: result.model });
    } catch (geminiErr) {
      console.warn("فشل Gemini (نفاد الحصة)، يتم التحويل إلى OpenRouter تلقائياً:", geminiErr.message);

      if (OPENROUTER_API_KEY) {
        try {
          const fallbackResult = await fetchOpenRouter(conversation, null);
          return res.json({
            reply: fallbackResult.answer,
            answer: fallbackResult.answer,
            provider: "openrouter",
            model: fallbackResult.model,
            fallback: true
          });
        } catch (openRouterErr) {
          return res.status(geminiErr.status || 500).json({
            error: `Gemini فشل بسبب: ${geminiErr.message} | OpenRouter فشل بسبب: ${openRouterErr.message}`
          });
        }
      }

      return res.status(geminiErr.status || 500).json({ error: geminiErr.message, details: geminiErr.details || null });
    }

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({ error: error?.message || "خطأ داخلي في الخادم" });
  }
});

/* =========================================================
   IMAGE & VOICE
========================================================= */
app.post("/api/image", async (req, res) => {
  try {
    const { prompt, width, height, model } = req.body;
    if (!prompt || !prompt.trim()) return res.status(400).json({ error: "وصف الصورة فارغ" });
    if (!PIXAZO_API_KEY) return res.status(500).json({ error: "PIXAZO_API_KEY غير موجود في Render" });

    const selectedModel = model || "flux";

    if (selectedModel === "flux") {
      let imageWidth = Number(width) || 512, imageHeight = Number(height) || 512;
      const validSize = [[512, 512], [512, 896], [896, 512]].some(([w, h]) => w === imageWidth && h === imageHeight);
      if (!validSize) { imageWidth = 512; imageHeight = 512; }

      const response = await fetch("https://gateway.pixazo.ai/flux-1-schnell/v1/getData", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Ocp-Apim-Subscription-Key": PIXAZO_API_KEY },
        body: JSON.stringify({ prompt: prompt.trim(), num_steps: 4, seed: 15, width: imageWidth, height: imageHeight })
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { return res.status(response.status).json({ error: `Pixazo Flux HTTP ${response.status}` }); }

      if (!response.ok) return res.status(response.status).json({ error: data?.message || data?.error || `Pixazo Flux HTTP ${response.status}` });
      if (!data?.output) return res.status(502).json({ error: "لم يرجع رابط الصورة" });

      return res.json({ success: true, imageUrl: data.output, provider: "pixazo", model: "flux", width: imageWidth, height: imageHeight });
    }

    if (selectedModel === "sdxl") {
      let imageWidth = Number(width) || 1024, imageHeight = Number(height) || 1024;
      if (imageWidth < 256 || imageWidth > 2048) imageWidth = 1024;
      if (imageHeight < 256 || imageHeight > 2048) imageHeight = 1024;

      const response = await fetch("https://gateway.pixazo.ai/getImage/v1/getSDXLImage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", "Ocp-Apim-Subscription-Key": PIXAZO_API_KEY },
        body: JSON.stringify({ prompt: prompt.trim(), negative_prompt: "blurry, low quality, distorted, watermark", height: imageHeight, width: imageWidth, num_steps: 20, guidance_scale: 5, seed: Math.floor(Math.random() * 1000000000) })
      });

      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { return res.status(response.status).json({ error: `Pixazo SDXL HTTP ${response.status}` }); }

      if (!response.ok) return res.status(response.status).json({ error: data?.message || data?.error || `Pixazo SDXL HTTP ${response.status}` });
      
      const imageUrl = data?.imageUrl || data?.output;
      if (!imageUrl) return res.status(502).json({ error: "لم يرجع رابط الصورة" });

      return res.json({ success: true, imageUrl, provider: "pixazo", model: "sdxl", width: imageWidth, height: imageHeight });
    }
    return res.status(400).json({ error: "نموذج الصورة غير معروف. استخدم flux أو sdxl." });
  } catch (error) {
    console.error("PIXAZO ERROR:", error);
    return res.status(500).json({ error: error?.message || "حدث خطأ أثناء إنشاء الصورة" });
  }
});

app.post("/api/voice", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "النص فارغ" });
    if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: "ELEVENLABS_API_KEY غير موجود في Render" });

    const voiceId = "JBFqnCBsd6RMkjVDRZzb";
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_multilingual_v2"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `ElevenLabs HTTP ${response.status}: ${errorText}` });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.setHeader("Cache-Control", "no-cache");

    return res.send(audioBuffer);

  } catch (error) {
    console.error("VOICE ERROR:", error);
    return res.status(500).json({ error: error?.message || "حدث خطأ أثناء إنشاء الصوت" });
  }
});

app.get("/api/voice-status", (req, res) => {
  res.json({
    voice: "ElevenLabs",
    configured: Boolean(ELEVENLABS_API_KEY),
    endpoint: "/api/voice"
  });
});

/* =========================================================
   START
========================================================= */
app.listen(PORT, () => {
  console.log(`ZAKA AI Backend يعمل على المنفذ ${PORT}`);
});
