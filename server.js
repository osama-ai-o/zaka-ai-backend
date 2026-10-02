require("dotenv").config();

const express = require("express");

const cors = require("cors");

const axios = require("axios");

const { GoogleGenerativeAI } = require("@google/generative-ai");

const googleTTS = require("google-tts-api");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json({ limit: "4mb" }));

/* =========================

   BASIC

========================= */

app.get("/", (req, res) => {

  res.json({

    ok: true,

    name: "ALWAFER AI",

    message: "🚀 خادم الويفر AI يعمل بنجاح"

  });

});

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    server: "zaka-ai",

    providers: {

      gemini: Boolean(process.env.GEMINI_API_KEY),

      openrouter: Boolean(process.env.OPENROUTER_API_KEY)

    }

  });

});

/* =========================

   HELPERS

========================= */

function normalizeMessages(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }

  return messages

    .filter(

      (msg) =>

        msg &&

        typeof msg.content !== "undefined" &&

        String(msg.content).trim()

    )

    .map((msg) => ({

      role: msg.role === "assistant" ? "assistant" : "user",

      content: String(msg.content)

    }));

}

function safeError(res, status, message) {

  return res.status(status).json({

    ok: false,

    error: message

  });

}

/* =========================

   GEMINI

========================= */

async function askGemini(messages) {

  if (!process.env.GEMINI_API_KEY) {

    throw new Error("GEMINI_API_KEY غير موجود");

  }

  const genAI = new GoogleGenerativeAI(

    process.env.GEMINI_API_KEY

  );

  const modelName =

    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const model = genAI.getGenerativeModel({

    model: modelName

  });

  const cleanMessages = normalizeMessages(messages);

  if (!cleanMessages.length) {

    throw new Error("لا توجد رسائل");

  }

  const history = cleanMessages

    .slice(0, -1)

    .map((msg) => ({

      role: msg.role === "assistant" ? "model" : "user",

      parts: [

        {

          text: msg.content

        }

      ]

    }));

  const lastMessage =

    cleanMessages[cleanMessages.length - 1].content;

  const chat = model.startChat({

    history

  });

  const result = await chat.sendMessage(lastMessage);

  return result.response.text();

}

/* =========================

   OPENROUTER

========================= */

async function askOpenRouter(messages) {

  if (!process.env.OPENROUTER_API_KEY) {

    throw new Error("OPENROUTER_API_KEY غير موجود");

  }

  const cleanMessages = normalizeMessages(messages);

  const response = await axios.post(

    "https://openrouter.ai/api/v1/chat/completions",

    {

      model:

        process.env.OPENROUTER_MODEL ||

        "openrouter/free",

      messages: cleanMessages,

      temperature: 0.7

    },

    {

      headers: {

        Authorization:

          `Bearer ${process.env.OPENROUTER_API_KEY}`,

        "Content-Type": "application/json",

        "HTTP-Referer":

          "https://zaka-ai-backend-1.onrender.com",

        "X-Title": "ALWAFER AI"

      },

      timeout: 60000

    }

  );

  const reply =

    response.data?.choices?.[0]?.message?.content;

  if (!reply) {

    throw new Error(

      "OpenRouter لم يرجع استجابة نصية"

    );

  }

  return reply;

}

/* =========================

   CHAT

========================= */

app.post("/api/chat", async (req, res) => {

  try {

    const {

      provider = "openrouter",

      messages

    } = req.body;

    const cleanMessages =

      normalizeMessages(messages);

    if (!cleanMessages.length) {

      return safeError(

        res,

        400,

        "لم يتم إرسال رسالة"

      );

    }

    let reply;

    if (

      provider === "gemini" ||

      provider.includes("gemini")

    ) {

      try {

        reply = await askGemini(cleanMessages);

      } catch (error) {

        const status =

          error?.response?.status;

        const message =

          String(error?.message || "").toLowerCase();

        const shouldFallback =

          status === 429 ||

          message.includes("quota") ||

          message.includes("resource exhausted") ||

          message.includes("rate");

        if (

          shouldFallback &&

          process.env.OPENROUTER_API_KEY

        ) {

          console.log(

            "⚠️ Gemini غير متاح، التحويل إلى OpenRouter..."

          );

          reply =

            await askOpenRouter(

              cleanMessages

            );

        } else {

          throw error;

        }

      }

    } else {

      reply =

        await askOpenRouter(

          cleanMessages

        );

    }

    return res.json({

      ok: true,

      reply

    });

  } catch (error) {

    console.error(

      "CHAT ERROR:",

      error?.response?.data ||

        error?.message ||

        error

    );

    return safeError(

      res,

      500,

      "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي"

    );

  }

});

/* =========================

   IMAGE GENERATION

========================= */

app.post("/api/image", async (req, res) => {

  try {

    const {

      prompt,

      width = 512,

      height = 512

    } = req.body;

    if (!prompt) {

      return safeError(

        res,

        400,

        "أدخل وصف الصورة أولاً"

      );

    }

    const safeWidth =

      Math.min(

        Math.max(Number(width) || 512, 256),

        1536

      );

    const safeHeight =

      Math.min(

        Math.max(Number(height) || 512, 256),

        1536

      );

    const encodedPrompt =

      encodeURIComponent(

        String(prompt)

      );

    const imageUrl =

      `https://image.pollinations.ai/prompt/${encodedPrompt}` +

      `?width=${safeWidth}` +

      `&height=${safeHeight}` +

      `&nologo=true`;

    return res.json({

      ok: true,

      imageUrl

    });

  } catch (error) {

    console.error(

      "IMAGE ERROR:",

      error?.message || error

    );

    return safeError(

      res,

      500,

      "تعذر إنشاء الصورة"

    );

  }

});

/* =========================

   TEXT TO SPEECH

========================= */

app.post("/api/voice", async (req, res) => {

  try {

    const { text } = req.body;

    if (!text) {

      return safeError(

        res,

        400,

        "لا يوجد نص لتحويله إلى صوت"

      );

    }

    const audioUrl =

      googleTTS.getAudioUrl(

        String(text),

        {

          lang: "ar",

          slow: false,

          host:

            "https://translate.google.com"

        }

      );

    const audioResponse =

      await axios.get(

        audioUrl,

        {

          responseType: "arraybuffer",

          timeout: 30000

        }

      );

    res.set({

      "Content-Type":

        "audio/mpeg",

      "Content-Length":

        audioResponse.data.length,

      "Cache-Control":

        "no-store"

    });

    return res.send(

      Buffer.from(

        audioResponse.data

      )

    );

  } catch (error) {

    console.error(

      "VOICE ERROR:",

      error?.message || error

    );

    return safeError(

      res,

      500,

      "تعذر إنشاء الصوت"

    );

  }

});

/* =========================

   SERVER

========================= */

app.listen(PORT, () => {

  console.log(

    `🚀 ALWAFER AI running on port ${PORT}`

  );

  console.log(

    "Gemini:",

    process.env.GEMINI_API_KEY

      ? "configured"

      : "missing"

  );

  console.log(

    "OpenRouter:",

    process.env.OPENROUTER_API_KEY

      ? "configured"

      : "missing"

  );

});
