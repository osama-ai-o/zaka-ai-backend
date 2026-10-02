require("dotenv").config();

const express = require("express");

const cors = require("cors");

const axios = require("axios");

const multer = require("multer");

const {

  GoogleGenerativeAI

} = require("@google/generative-ai");

const app = express();

const PORT =

  process.env.PORT || 3000;

/* =========================================================

   CONFIG

========================================================= */

const CONFIG = {

  geminiModel:

    process.env.GEMINI_MODEL ||

    "gemini-2.5-flash",

  openaiModel:

    process.env.OPENAI_MODEL ||

    "gpt-5",

  openrouterModel:

    process.env.OPENROUTER_MODEL ||

    "openrouter/free",

  elevenModel:

    process.env.ELEVENLABS_MODEL ||

    "eleven_multilingual_v2",

  elevenVoice:

    process.env.ELEVENLABS_VOICE_ID ||

    ""

};

/* =========================================================

   APP

========================================================= */

app.use(cors());

app.use(

  express.json({

    limit: "8mb"

  })

);

/* =========================================================

   MULTER

========================================================= */

const upload =

  multer({

    storage:

      multer.memoryStorage(),

    limits: {

      fileSize:

        15 * 1024 * 1024

    }

  });

/* =========================================================

   HELPERS

========================================================= */

function cleanMessages(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }

  return messages

    .filter(

      (m) =>

        m &&

        typeof m.content !==

          "undefined" &&

        String(m.content).trim()

    )

    .map((m) => ({

      role:

        m.role === "assistant"

          ? "assistant"

          : "user",

      content:

        String(m.content)

    }));

}

function errorResponse(

  res,

  status,

  message

) {

  return res.status(status).json({

    ok: false,

    error: message

  });

}

/* =========================================================

   HOME

========================================================= */

app.get("/", (req, res) => {

  res.json({

    ok: true,

    name: "ALWAFER AI",

    version: "3.0.0",

    message:

      "🚀 الويفر AI يعمل بنجاح"

  });

});

/* =========================================================

   HEALTH

========================================================= */

app.get(

  "/api/health",

  (req, res) => {

    res.json({

      ok: true,

      server:

        "ALWAFER AI",

      providers: {

        gemini:

          Boolean(

            process.env.GEMINI_API_KEY

          ),

        openai:

          Boolean(

            process.env.OPENAI_API_KEY

          ),

        openrouter:

          Boolean(

            process.env.OPENROUTER_API_KEY

          ),

        elevenlabs:

          Boolean(

            process.env

              .ELEVENLABS_API_KEY

          ),

        pixazo:

          Boolean(

            process.env.PIXAZO_API_KEY

          )

      },

      features: {

        chat: true,

        image: true,

        voice: true,

        files: true

      }

    });

  }

);

/* =========================================================

   GEMINI

========================================================= */

async function askGemini(

  messages

) {

  if (

    !process.env.GEMINI_API_KEY

  ) {

    throw new Error(

      "Gemini API key missing"

    );

  }

  const genAI =

    new GoogleGenerativeAI(

      process.env.GEMINI_API_KEY

    );

  const model =

    genAI.getGenerativeModel({

      model:

        CONFIG.geminiModel

    });

  const clean =

    cleanMessages(messages);

  if (!clean.length) {

    throw new Error(

      "No messages"

    );

  }

  const history =

    clean

      .slice(0, -1)

      .map((m) => ({

        role:

          m.role === "assistant"

            ? "model"

            : "user",

        parts: [

          {

            text:

              m.content

          }

        ]

      }));

  const last =

    clean[

      clean.length - 1

    ].content;

  const chat =

    model.startChat({

      history

    });

  const result =

    await chat.sendMessage(

      last

    );

  return result.response.text();

}

/* =========================================================

   OPENAI

========================================================= */

async function askOpenAI(

  messages

) {

  if (

    !process.env.OPENAI_API_KEY

  ) {

    throw new Error(

      "OpenAI API key missing"

    );

  }

  const clean =

    cleanMessages(messages);

  const response =

    await axios.post(

      "https://api.openai.com/v1/responses",

      {

        model:

          CONFIG.openaiModel,

        input:

          clean.map((m) => ({

            role: m.role,

            content: [

              {

                type:

                  "input_text",

                text:

                  m.content

              }

            ]

          }))

      },

      {

        headers: {

          Authorization:

            `Bearer ${process.env.OPENAI_API_KEY}`,

          "Content-Type":

            "application/json"

        },

        timeout: 60000

      }

    );

  if (

    response.data?.output_text

  ) {

    return response.data

      .output_text;

  }

  throw new Error(

    "OpenAI returned no text"

  );

}

/* =========================================================

   OPENROUTER

========================================================= */

async function askOpenRouter(

  messages

) {

  if (

    !process.env

      .OPENROUTER_API_KEY

  ) {

    throw new Error(

      "OpenRouter API key missing"

    );

  }

  const clean =

    cleanMessages(messages);

  const response =

    await axios.post(

      "https://openrouter.ai/api/v1/chat/completions",

      {

        model:

          CONFIG.openrouterModel,

        messages:

          clean

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

        timeout: 60000

      }

    );

  const reply =

    response.data

      ?.choices?.[0]

      ?.message?.content;

  if (!reply) {

    throw new Error(

      "OpenRouter returned no text"

    );

  }

  return reply;

}

/* =========================================================

   CHAT

========================================================= */

app.post(

  "/api/chat",

  async (req, res) => {

    try {

      const {

        provider =

          "openrouter",

        messages

      } = req.body;

      const clean =

        cleanMessages(

          messages

        );

      if (!clean.length) {

        return errorResponse(

          res,

          400,

          "أرسل رسالة أولاً"

        );

      }

      let reply;

      if (

        provider === "gemini"

      ) {

        try {

          reply =

            await askGemini(

              clean

            );

        } catch (error) {

          console.error(

            "Gemini:",

            error.message

          );

          if (

            process.env

              .OPENROUTER_API_KEY

          ) {

            reply =

              await askOpenRouter(

                clean

              );

          } else {

            throw error;

          }

        }

      }

      else if (

        provider === "openai"

      ) {

        try {

          reply =

            await askOpenAI(

              clean

            );

        } catch (error) {

          console.error(

            "OpenAI:",

            error.message

          );

          if (

            process.env

              .GEMINI_API_KEY

          ) {

            reply =

              await askGemini(

                clean

              );

          }

          else if (

            process.env

              .OPENROUTER_API_KEY

          ) {

            reply =

              await askOpenRouter(

                clean

              );

          }

          else {

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

            error.message

          );

          if (

            process.env

              .GEMINI_API_KEY

          ) {

            reply =

              await askGemini(

                clean

              );

          }

          else if (

            process.env

              .OPENAI_API_KEY

          ) {

            reply =

              await askOpenAI(

                clean

              );

          }

          else {

            throw error;

          }

        }

      }

      return res.json({

        ok: true,

        reply

      });

    } catch (error) {

      console.error(

        "CHAT ERROR:",

        error?.response

          ?.data ||

          error.message ||

          error

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

   FILE ANALYSIS - GEMINI

========================================================= */

async function analyzeFileWithGemini(

  file,

  question

) {

  if (

    !process.env.GEMINI_API_KEY

  ) {

    throw new Error(

      "Gemini API key missing"

    );

  }

  const genAI =

    new GoogleGenerativeAI(

      process.env.GEMINI_API_KEY

    );

  const model =

    genAI.getGenerativeModel({

      model:

        CONFIG.geminiModel

    });

  const mimeType =

    file.mimetype ||

    "application/octet-stream";

  const isText =

    mimeType.startsWith(

      "text/"

    ) ||

    mimeType ===

      "application/json" ||

    mimeType ===

      "text/csv";

  let parts = [];

  if (isText) {

    const text =

      file.buffer.toString(

        "utf8"

      );

    parts.push({

      text:

        `هذا ملف مرفوع من المستخدم.

اسم الملف:

${file.originalname}

محتوى الملف:

${text}

طلب المستخدم:

${question || "حلل الملف واشرح محتواه بالتفصيل."}

قدم تحليلًا واضحًا ومنظمًا باللغة العربية.`

    });

  }

  else {

    const base64 =

      file.buffer.toString(

        "base64"

      );

    parts.push({

      inlineData: {

        mimeType,

        data: base64

      }

    });

    parts.push({

      text:

        `حلل الملف المرفوع.

اسم الملف:

${file.originalname}

طلب المستخدم:

${question || "حلل الملف واشرح محتواه بالتفصيل."}

أجب بالعربية بشكل واضح ومنظم.`

    });

  }

  const result =

    await model.generateContent(

      parts

    );

  return result.response.text();

}

/* =========================================================

   FILE ROUTE

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

          "لم يتم رفع ملف"

        );

      }

      const question =

        req.body?.question ||

        "حلل هذا الملف واشرح أهم محتوياته.";

      const allowedTypes = [

        "application/pdf",

        "text/plain",

        "text/csv",

        "application/json",

        "image/png",

        "image/jpeg",

        "image/webp"

      ];

      if (

        !allowedTypes.includes(

          req.file.mimetype

        )

      ) {

        return errorResponse(

          res,

          400,

          "نوع الملف غير مدعوم حاليًا"

        );

      }

      const result =

        await analyzeFileWithGemini(

          req.file,

          question

        );

      return res.json({

        ok: true,

        filename:

          req.file.originalname,

        mimetype:

          req.file.mimetype,

        size:

          req.file.size,

        reply: result

      });

    } catch (error) {

      console.error(

        "FILE ERROR:",

        error?.response

          ?.data ||

          error.message ||

          error

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

        width = 512,

        height = 512

      } = req.body;

      if (!prompt) {

        return errorResponse(

          res,

          400,

          "أدخل وصف الصورة"

        );

      }

      const safeWidth =

        Math.min(

          Math.max(

            Number(width) || 512,

            256

          ),

          1536

        );

      const safeHeight =

        Math.min(

          Math.max(

            Number(height) || 512,

            256

          ),

          1536

        );

      const encoded =

        encodeURIComponent(

          String(prompt)

        );

      const imageUrl =

        `https://image.pollinations.ai/prompt/${encoded}` +

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

        error.message

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

async function elevenLabsVoice(

  text

) {

  if (

    !process.env

      .ELEVENLABS_API_KEY

  ) {

    throw new Error(

      "ElevenLabs API key missing"

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

        text:

          String(text),

        model_id:

          CONFIG.elevenModel,

        output_format:

          "mp3_44100_128"

      },

      {

        headers: {

          "xi-api-key":

            process.env

              .ELEVENLABS_API_KEY,

          "Content-Type":

            "application/json",

          Accept:

            "audio/mpeg"

        },

        responseType:

          "arraybuffer",

        timeout: 60000

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

      const { text } =

        req.body;

      if (!text) {

        return errorResponse(

          res,

          400,

          "لا يوجد نص صوتي"

        );

      }

      if (

        process.env

          .ELEVENLABS_API_KEY &&

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

          return res.send(

            audio

          );

        } catch (error) {

          console.error(

            "ElevenLabs:",

            error.message

          );

        }

      }

      const googleTTS =

        require(

          "google-tts-api"

        );

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

      const response =

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

          response.data

        );

      res.set({

        "Content-Type":

          "audio/mpeg",

        "Content-Length":

          audio.length,

        "Cache-Control":

          "no-store"

      });

      return res.send(

        audio

      );

    } catch (error) {

      console.error(

        "VOICE ERROR:",

        error.message

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

      `🚀 ALWAFER AI running on port ${PORT}`

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

      process.env

        .ELEVENLABS_API_KEY

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
