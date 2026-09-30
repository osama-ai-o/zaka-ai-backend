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
   MODELS
========================================================= */
// تم تصحيح اسم النموذج إلى إصدار حقيقي من جوجل
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

/* =========================================================
   HOME
========================================================= */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "ZAKA AI",
    message: "ZAKA AI Backend يعمل بنجاح 🚀"
  });
});

/* =========================================================
   HEALTH
========================================================= */
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
   CHAT
========================================================= */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, messages, provider, model } = req.body;

    let conversation = [];

    if (Array.isArray(messages) && messages.length > 0) {
      conversation = messages
        .filter(item => item && item.content)
        .map(item => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: String(item.content) }]
        }));
    }

    if (conversation.length === 0 && typeof message === "string" && message.trim()) {
      conversation = [
        {
          role: "user",
          parts: [{ text: message.trim() }]
        }
      ];
    }

    if (conversation.length === 0) {
      return res.status(400).json({ error: "الرسالة فارغة" });
    }

    /* =====================================================
       GEMINI
    ===================================================== */
    if (!provider || provider === "gemini") {
      if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY غير موجود في Render" });
      }

      const selectedModel = model && model !== "gemini" ? model : DEFAULT_GEMINI_MODEL;
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
      console.log("Gemini:", response.status, JSON.stringify(data));

      if (!response.ok) {
        const googleMessage = data?.error?.message || data?.error?.status || `Gemini HTTP ${response.status}`;
        return res.status(response.status).json({
          error: googleMessage,
          status: response.status,
          provider: "gemini",
          model: selectedModel,
          details: data?.error || null
        });
      }

      const answer = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || "").join("").trim();

      if (!answer) {
        console.error("Gemini returned no text:", JSON.stringify(data));
        return res.status(502).json({
          error: "Gemini لم يرجع نصًا",
          details: data
        });
      }

      return res.json({
        reply: answer,
        answer: answer,
        provider: "gemini",
        model: selectedModel
      });
    }

    /* =====================================================
       OPENROUTER
    ===================================================== */
    if (provider === "openrouter") {
      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ error: "OPENROUTER_API_KEY غير موجود في Render" });
      }

      const selectedModel = model && model !== "openrouter" ? model : "openrouter/free";

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
      console.log("OpenRouter:", response.status, JSON.stringify(data));

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.error?.message || `OpenRouter HTTP ${response.status}`
        });
      }

      const answer = data?.choices?.[0]?.message?.content;

      if (!answer) {
        return res.status(502).json({ error: "OpenRouter لم يرجع نصًا" });
      }

      return res.json({
        reply: answer,
        answer: answer,
        provider: "openrouter",
        model: selectedModel
      });
    }

    return res.status(400).json({ error: "مزود الذكاء الاصطناعي غير معروف" });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return res.status(500).json({ error: error?.message || "خطأ داخلي في الخادم" });
  }
});

/* =========================================================
   IMAGE - PIXAZO
========================================================= */
app.post("/api/image", async (req, res) => {
  try {
    const { prompt, width, height, model } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "وصف الصورة فارغ" });
    }

    if (!PIXAZO_API_KEY) {
      return res.status(500).json({ error: "PIXAZO_API_KEY غير موجود في Render" });
    }

    const selectedModel = model || "flux";

    /* =====================================================
       FLUX
    ===================================================== */
    if (selectedModel === "flux") {
      let imageWidth = Number(width) || 512;
      let imageHeight = Number(height) || 512;

      const allowedSizes = [
        [512, 512],
        [512, 896],
        [896, 512]
      ];

      const validSize = allowedSizes.some(([w, h]) => w === imageWidth && h === imageHeight);

      if (!validSize) {
        imageWidth = 512;
        imageHeight = 512;
      }

      const response = await fetch("https://gateway.pixazo.ai/flux-1-schnell/v1/getData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": PIXAZO_API_KEY
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          num_steps: 4,
          seed: 15,
          width: imageWidth,
          height: imageHeight
        })
      });

      const text = await response.text();
      console.log("Pixazo Flux:", response.status, text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(response.status).json({
          error: text || `Pixazo Flux HTTP ${response.status}`
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || data?.error || `Pixazo Flux HTTP ${response.status}`
        });
      }

      const imageUrl = data?.output;

      if (!imageUrl) {
        return res.status(502).json({
          error: "Pixazo Flux لم يرجع رابط الصورة",
          pixazo: data
        });
      }

      return res.json({
        success: true,
        imageUrl,
        provider: "pixazo",
        model: "flux",
        width: imageWidth,
        height: imageHeight
      });
    }

    /* =====================================================
       SDXL
    ===================================================== */
    if (selectedModel === "sdxl") {
      let imageWidth = Number(width) || 1024;
      let imageHeight = Number(height) || 1024;

      if (imageWidth < 256 || imageWidth > 2048) imageWidth = 1024;
      if (imageHeight < 256 || imageHeight > 2048) imageHeight = 1024;

      const response = await fetch("https://gateway.pixazo.ai/getImage/v1/getSDXLImage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": PIXAZO_API_KEY
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: "blurry, low quality, distorted, watermark",
          height: imageHeight,
          width: imageWidth,
          num_steps: 20,
          guidance_scale: 5,
          seed: Math.floor(Math.random() * 1000000000)
        })
      });

      const text = await response.text();
      console.log("Pixazo SDXL:", response.status, text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(response.status).json({
          error: text || `Pixazo SDXL HTTP ${response.status}`
        });
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || data?.error || `Pixazo SDXL HTTP ${response.status}`
        });
      }

      const imageUrl = data?.imageUrl || data?.output;

      if (!imageUrl) {
        return res.status(502).json({
          error: "Pixazo SDXL لم يرجع رابط الصورة",
          pixazo: data
        });
      }

      return res.json({
        success: true,
        imageUrl,
        provider: "pixazo",
        model: "sdxl",
        width: imageWidth,
        height: imageHeight
      });
    }

    return res.status(400).json({ error: "نموذج الصورة غير معروف. استخدم flux أو sdxl." });

  } catch (error) {
    console.error("PIXAZO ERROR:", error);
    return res.status(500).json({ error: error?.message || "حدث خطأ أثناء إنشاء الصورة" });
  }
});

/* =========================================================
   VOICE - ELEVENLABS
========================================================= */
app.post("/api/voice", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "النص فارغ" });
    }

    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY غير موجود في Render" });
    }

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
      console.error("ElevenLabs:", response.status, errorText);
      return res.status(response.status).json({
        error: `ElevenLabs HTTP ${response.status}: ${errorText}`
      });
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

/* =========================================================
   VOICE STATUS
========================================================= */
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
