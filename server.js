const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const DEFAULT_MODEL = "gemini-3.8-flash";

app.get("/", (req, res) => {
  res.json({
    status: "online",
    name: "ZAKA AI",
    message: "ZAKA AI Backend يعمل بنجاح 🚀"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, provider, model } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "الرسالة فارغة"
      });
    }

    const selectedProvider = provider || "gemini";

    // =========================
    // GEMINI
    // =========================

    if (selectedProvider === "gemini") {

      if (!GEMINI_API_KEY) {
        return res.status(500).json({
          error: "GEMINI_API_KEY غير موجود"
        });
      }

      const selectedModel = model || DEFAULT_MODEL;

      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: message
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "Gemini API Error"
        });
      }

      const answer =
        data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("")
          .trim();

      if (!answer) {
        return res.status(502).json({
          error: "Gemini لم يرجع ردًا"
        });
      }

      return res.json({
        answer,
        provider: "gemini",
        model: selectedModel
      });
    }

// =========================
// OPENROUTER
// =========================

if (selectedProvider === "openrouter") {

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY غير موجود في Render"
    });
  }

  const selectedModel = model || "openrouter/free";

  try {

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://zaka-ai-backend-1.onrender.com",
          "X-Title": "ZAKA AI"
        },

        body: JSON.stringify({
          model: selectedModel,
          messages: [
            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("OpenRouter status:", response.status);
    console.log("OpenRouter response:", JSON.stringify(data));

    if (!response.ok) {

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.error?.code ||
          `OpenRouter HTTP ${response.status}`
      });

    }

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {

      return res.status(502).json({
        error: "OpenRouter لم يرجع نصًا"
      });

    }

    return res.json({
      answer: answer,
      provider: "openrouter",
      model: selectedModel
    });

  } catch (error) {

    console.error("OpenRouter connection error:", error);

    return res.status(500).json({
      error: `خطأ في الاتصال بـ OpenRouter: ${error.message}`
    });

  }
}
