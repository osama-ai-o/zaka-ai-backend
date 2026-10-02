require("dotenv").config();

const express = require("express");

const cors = require("cors");

const axios = require("axios");

const multer = require("multer");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json({ limit: "20mb" }));

const upload = multer({

  storage: multer.memoryStorage(),

  limits: {

    fileSize: 15 * 1024 * 1024

  }

});

/* =========================================================

   CONFIG

========================================================= */

const CONFIG = {

  geminiModel:

    process.env.GEMINI_MODEL || "gemini-3.8-flash",

  openaiModel:

    process.env.OPENAI_MODEL || "gpt-6-luna",

  openrouterModel:

    process.env.OPENROUTER_MODEL || "openrouter/free",

  elevenModel:

    process.env.ELEVENLABS_MODEL ||

    "eleven_multilingual_v2",

  elevenVoice:

    process.env.ELEVENLABS_VOICE_ID || "",

  systemPrompt:

    process.env.ALWAFER_SYSTEM_PROMPT ||

    `

أنت الويفر AI - ALWAFER AI.

أنت مساعد ذكاء اصطناعي عربي احترافي ومتعدد الاستخدامات.

أجب باللغة التي يستخدمها المستخدم، وإذا تحدث بالعربية فأجب بالعربية.

كن دقيقًا وواضحًا ومنظمًا.

في البرمجة أعط حلولًا عملية وكودًا صحيحًا.

لا تدّعي تنفيذ شيء لم تنفذه فعليًا.

إذا كانت المعلومة غير مؤكدة فاذكر ذلك بوضوح.

`

};

/* =========================================================

   HELPERS

========================================================= */

function cleanMessages(messages) {

  if (!Array.isArray(messages)) return [];

  return messages

    .filter(

      (m) =>

        m &&

        typeof m.content !== "undefined" &&

        String(m.content).trim()

    )

    .map((m) => ({

      role:

        m.role === "assistant"

          ? "assistant"

          : "user",

      content: String(m.content)

    }));

}

function errorResponse(res, status, message) {

  return res.status(status).json({

    ok: false,

    error: message

  });

}

function getErrorMessage(error) {

  return (

    error?.response?.data?.error?.message ||

    error?.response?.data?.error ||

    error?.message ||

    "Unknown error"

  );

}

/* =========================================================

   HEALTH

========================================================= */

app.get("/", (req, res) => {

  res.json({

    ok: true,

    name: "ALWAFER AI",

    version: "4.0.0",

    message: "🚀 الويفر AI يعمل بنجاح"

  });

});

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    name: "ALWAFER AI",

    version: "4.0.0",

    providers: {

      gemini: Boolean(

        process.env.GEMINI_API_KEY

      ),

      openai: Boolean(

        process.env.OPENAI_API_KEY

      ),

      openrouter: Boolean(

        process.env.OPENROUTER_API_KEY

      ),

      elevenlabs: Boolean(

        process.env.ELEVENLABS_API_KEY

      ),

      pixazo: Boolean(

        process.env.PIXAZO_API_KEY

      )

    },

    models: {

      gemini: CONFIG.geminiModel,

      openai: CONFIG.openaiModel,

      openrouter:

        CONFIG.openrouterModel

    }

  });

});

/* =========================================================

   GEMINI

========================================================= */

async function askGemini(messages) {

  if (!process.env.GEMINI_API_KEY) {

    throw new Error(

      "GEMINI_API_KEY غير موجود"

    );

  }

  const clean = cleanMessages(messages);

  if (!clean.length) {

    throw new Error("لا توجد رسائل");

  }

  const contents = [

    {

      role: "user",

      parts: [

        {

          text:

            CONFIG.systemPrompt

        }

      ]

    }

  ];

  for (const message of clean) {

    contents.push({

      role:

        message.role === "assistant"

          ? "model"

          : "user",

      parts: [

        {

          text: message.content

        }

      ]

    });

  }

  const response = await axios.post(

    `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,

    {

      contents

    },

    {

      headers: {

        "Content-Type":

          "application/json"

      },

      timeout: 90000

    }

  );

  const parts =

    response.data

      ?.candidates?.[0]

      ?.content?.parts || [];

  const text = parts

    .map((part) => part.text || "")

    .join("")

    .trim();

  if (!text) {

    throw new Error(

      "Gemini لم يرجع نصًا"

    );

  }

  return text;

}

/* =========================================================

   OPENAI

========================================================= */

async function askOpenAI(messages) {

  if (!process.env.OPENAI_API_KEY) {

    throw new Error(

      "OPENAI_API_KEY غير موجود"

    );

  }

  const clean = cleanMessages(messages);

  const input = [

    {

      role: "developer",

      content: CONFIG.systemPrompt

    },

    ...clean.map((message) => ({

      role: message.role,

      content: [

        {

          type:

            message.role === "user"

              ? "input_text"

              : "output_text",

          text: message.content

        }

      ]

    }))

  ];

  const response = await axios.post(

    "https://api.openai.com/v1/responses",

    {

      model: CONFIG.openaiModel,

      input

    },

    {

      headers: {

        Authorization:

          `Bearer ${process.env.OPENAI_API_KEY}`,

        "Content-Type":

          "application/json"

      },

      timeout: 90000

    }

  );

  if (response.data?.output_text) {

    return response.data.output_text;

  }

  let text = "";

  for (

    const item of

    response.data?.output || []

  ) {

    for (

      const content of

      item.content || []

    ) {

      if (

        content.type ===

        "output_text"

      ) {

        text +=

          content.text || "";

      }

    }

  }

  if (!text.trim()) {

    throw new Error(

      "OpenAI لم يرجع نصًا"

    );

  }

  return text.trim();

}

/* =========================================================

   OPENROUTER

========================================================= */

async function askOpenRouter(messages) {

  if (!process.env.OPENROUTER_API_KEY) {

    throw new Error(

      "OPENROUTER_API_KEY غير موجود"

    );

  }

  const clean = cleanMessages(messages);

  const response = await axios.post(

    "https://openrouter.ai/api/v1/chat/completions",

    {

      model:

        CONFIG.openrouterModel,

      messages: [

        {

          role: "system",

          content:

            CONFIG.systemPrompt

        },

        ...clean

      ]

    },

    {

      headers: {

        Authorization:

          `Bearer ${process.env.OPENROUTER_API_KEY}`,

        "Content-Type":

          "application/json",

        "HTTP-Referer":

          "https://zaka-ai-backend-1.onrender.com",

        "X-Title":

          "ALWAFER AI"

      },

      timeout: 90000

    }

  );

  const reply =

    response.data

      ?.choices?.[0]

      ?.message?.content;

  if (!reply) {

    throw new Error(

      "OpenRouter لم يرجع نصًا"

    );

  }

  return String(reply);

}

/* =========================================================

   CHAT

========================================================= */

app.post(

  "/api/chat",

  async (req, res) => {

    try {

      const {

        provider = "openrouter",

        messages

      } = req.body || {};

      const clean =

        cleanMessages(messages);

      if (!clean.length) {

        return errorResponse(

          res,

          400,

          "أرسل رسالة أولاً"

        );

      }

      let reply = null;

      let usedProvider = provider;

      if (provider === "openai") {

        try {

          reply =

            await askOpenAI(clean);

        } catch (error) {

          console.error(

            "OpenAI:",

            getErrorMessage(error)

          );

          if (

            process.env.GEMINI_API_KEY

          ) {

            usedProvider = "gemini";

            reply =

              await askGemini(clean);

          } else if (

            process.env

              .OPENROUTER_API_KEY

          ) {

            usedProvider =

              "openrouter";

            reply =

              await askOpenRouter(

                clean

              );

          } else {

            throw error;

          }

        }

      }

      else if (provider === "gemini") {

        try {

          reply =

            await askGemini(clean);

        } catch (error) {

          console.error(

            "Gemini:",

            getErrorMessage(error)

          );

          if (

            process.env.OPENAI_API_KEY

          ) {

            usedProvider = "openai";

            reply =

              await askOpenAI(clean);

          } else if (

            process.env

              .OPENROUTER_API_KEY

          ) {

            usedProvider =

              "openrouter";

            reply =

              await askOpenRouter(

                clean

              );

          } else {

            throw error;

          }

        }

      }

      else {

        try {

          reply =

            await askOpenRouter(

              clean

            );

        } catch (error) {

          console.error(

            "OpenRouter:",

            getErrorMessage(error)

          );

          if (

            process.env.GEMINI_API_KEY

          ) {

            usedProvider = "gemini";

            reply =

              await askGemini(clean);

          } else if (

            process.env.OPENAI_API_KEY

          ) {

            usedProvider = "openai";

            reply =

              await askOpenAI(clean);

          } else {

            throw error;

          }

        }

      }

      return res.json({

        ok: true,

        reply: String(reply),

        provider: usedProvider

      });

    } catch (error) {

      console.error(

        "CHAT ERROR:",

        getErrorMessage(error)

      );

      return errorResponse(

        res,

        500,

        "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي"

      );

    }

  }

);

/* =========================================================

   FILE ANALYSIS

========================================================= */

app.post(

  "/api/analyze-file",

  upload.single("file"),

  async (req, res) => {

    try {

      if (!req.file) {

        return errorResponse(

          res,

          400,

          "لم يتم إرسال ملف"

        );

      }

      if (!process.env.GEMINI_API_KEY) {

        return errorResponse(

          res,

          500,

          "تحليل الملفات يحتاج GEMINI_API_KEY"

        );

      }

      const question =

        String(

          req.body?.question ||

          "حلل الملف واستخرج أهم المعلومات منه واشرحها بالعربية بشكل واضح ومنظم."

        );

      const mime =

        req.file.mimetype ||

        "application/octet-stream";

      const isText =

        mime === "text/plain" ||

        mime === "text/csv" ||

        mime === "application/json";

      let contents;

      if (isText) {

        const text =

          req.file.buffer.toString(

            "utf8"

          );

        contents = [

          {

            role: "user",

            parts: [

              {

                text:

                  CONFIG.systemPrompt

              },

              {

                text:

                  `الملف المرفوع اسمه: ${req.file.originalname}\n\n` +

                  `السؤال:\n${question}\n\n` +

                  `محتوى الملف:\n${text}`

              }

            ]

          }

        ];

      }

      else {

        const base64 =

          req.file.buffer.toString(

            "base64"

          );

        contents = [

          {

            role: "user",

            parts: [

              {

                text:

                  CONFIG.systemPrompt

              },

              {

                text:

                  `حلل الملف التالي.\n\nالسؤال:\n${question}`

              },

              {

                inline_data: {

                  mime_type: mime,

                  data: base64

                }

              }

            ]

          }

        ];

      }

      const response =

        await axios.post(

          `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${process.env.GEMINI_API_KEY}`,

          {

            contents

          },

          {

            headers: {

              "Content-Type":

                "application/json"

            },

            timeout: 120000

          }

        );

      const parts =

        response.data

          ?.candidates?.[0]

          ?.content?.parts || [];

      const reply = parts

        .map(

          (part) =>

            part.text || ""

        )

        .join("")

        .trim();

      if (!reply) {

        throw new Error(

          "لم يرجع Gemini نتيجة لتحليل الملف"

        );

      }

      return res.json({

        ok: true,

        file: req.file.originalname,

        reply

      });

    } catch (error) {

      console.error(

        "FILE ERROR:",

        getErrorMessage(error)

      );

      return errorResponse(

        res,

        500,

        "تعذر تحليل الملف"

      );

    }

  }

);

/* =========================================================

   IMAGE

========================================================= */

app.post(

  "/api/image",

  async (req, res) => {

    try {

      const {

        prompt,

        model = "flux",

        width = 512,

        height = 512

      } = req.body || {};

      if (!prompt?.trim()) {

        return errorResponse(

          res,

          400,

          "أدخل وصف الصورة"

        );

      }

      const safeWidth = Math.min(

        Math.max(

          Number(width) || 512,

          256

        ),

        1536

      );

      const safeHeight = Math.min(

        Math.max(

          Number(height) || 512,

          256

        ),

        1536

      );

      /*

        Pollinations الحالي يدعم اختيار

        نموذج الصورة عبر model.

      */

      const imageModel =

        model === "sdxl"

          ? "black-forest-labs/flux.1-schnell"

          : "flux";

      const encodedPrompt =

        encodeURIComponent(

          String(prompt)

        );

      const imageUrl =

        "https://gen.pollinations.ai/image/" +

        encodedPrompt +

        `?model=${encodeURIComponent(

          imageModel

        )}` +

        `&width=${safeWidth}` +

        `&height=${safeHeight}`;

      return res.json({

        ok: true,

        imageUrl,

        model: imageModel

      });

    } catch (error) {

      console.error(

        "IMAGE ERROR:",

        getErrorMessage(error)

      );

      return errorResponse(

        res,

        500,

        "تعذر إنشاء الصورة"

      );

    }

  }

);

/* =========================================================

   ELEVENLABS

========================================================= */

async function elevenLabsVoice(text) {

  if (!process.env.ELEVENLABS_API_KEY) {

    throw new Error(

      "ELEVENLABS_API_KEY غير موجود"

    );

  }

  if (!CONFIG.elevenVoice) {

    throw new Error(

      "ELEVENLABS_VOICE_ID غير موجود"

    );

  }

  const response =

    await axios.post(

      `https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.elevenVoice}`,

      {

        text: String(text),

        model_id:

          CONFIG.elevenModel,

        output_format:

          "mp3_44100_128"

      },

      {

        headers: {

          "xi-api-key":

            process.env.ELEVENLABS_API_KEY,

          "Content-Type":

            "application/json",

          Accept:

            "audio/mpeg"

        },

        responseType:

          "arraybuffer",

        timeout: 90000

      }

    );

  return Buffer.from(

    response.data

  );

}

/* =========================================================

   VOICE

========================================================= */

app.post(

  "/api/voice",

  async (req, res) => {

    try {

      const text =

        String(

          req.body?.text || ""

        ).trim();

      if (!text) {

        return errorResponse(

          res,

          400,

          "لا يوجد نص صوتي"

        );

      }

      if (

        process.env.ELEVENLABS_API_KEY &&

        CONFIG.elevenVoice

      ) {

        try {

          const audio =

            await elevenLabsVoice(

              text

            );

          res.set({

            "Content-Type":

              "audio/mpeg",

            "Content-Length":

              audio.length,

            "Cache-Control":

              "no-store"

          });

          return res.send(audio);

        } catch (error) {

          console.error(

            "ElevenLabs:",

            getErrorMessage(error)

          );

        }

      }

      const googleTTS =

        require("google-tts-api");

      const audioUrl =

        googleTTS.getAudioUrl(

          text,

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

            responseType:

              "arraybuffer",

            timeout: 30000

          }

        );

      const audio =

        Buffer.from(

          audioResponse.data

        );

      res.set({

        "Content-Type":

          "audio/mpeg",

        "Content-Length":

          audio.length,

        "Cache-Control":

          "no-store"

      });

      return res.send(audio);

    } catch (error) {

      console.error(

        "VOICE ERROR:",

        getErrorMessage(error)

      );

      return errorResponse(

        res,

        500,

        "تعذر إنشاء الصوت"

      );

    }

  }

);

/* =========================================================

   START

========================================================= */

app.listen(

  PORT,

  () => {

    console.log(

      `🚀 ALWAFER AI 4.0 running on port ${PORT}`

    );

    console.log(

      "Gemini:",

      process.env.GEMINI_API_KEY

        ? "ON"

        : "OFF"

    );

    console.log(

      "OpenAI:",

      process.env.OPENAI_API_KEY

        ? "ON"

        : "OFF"

    );

    console.log(

      "OpenRouter:",

      process.env.OPENROUTER_API_KEY

        ? "ON"

        : "OFF"

    );

    console.log(

      "ElevenLabs:",

      process.env.ELEVENLABS_API_KEY

        ? "ON"

        : "OFF"

    );

    console.log(

      "Pixazo:",

      process.env.PIXAZO_API_KEY

        ? "ON"

        : "OFF"

    );

  }

);
