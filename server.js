const express = require("express");

const cors = require("cors");

const path = require("path");

const fs = require("fs");

const app = express();

/* =========================================================

   CONFIG

========================================================= */

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY =

  process.env.GEMINI_API_KEY;

const OPENROUTER_API_KEY =

  process.env.OPENROUTER_API_KEY;

const PIXAZO_API_KEY =

  process.env.PIXAZO_API_KEY;

const ELEVENLABS_API_KEY =

  process.env.ELEVENLABS_API_KEY;

const GEMINI_MODEL =

  process.env.GEMINI_MODEL ||

  "gemini-3.8-flash";

const OPENROUTER_MODEL =

  "openrouter/free";

const ELEVENLABS_VOICE_ID =

  process.env.ELEVENLABS_VOICE_ID ||

  "JBFqnCBsd6RMkjVDRZzb";

/* =========================================================

   MIDDLEWARE

========================================================= */

app.use(

  cors({

    origin: true,

    methods: ["GET", "POST", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"]

  })

);

app.use(

  express.json({

    limit: "5mb"

  })

);

/* =========================================================

   FRONTEND DETECTION

========================================================= */

const rootDir = __dirname;

const publicDir =

  path.join(rootDir, "public");

let frontendDir = null;

if (

  fs.existsSync(

    path.join(publicDir, "index.html")

  )

) {

  frontendDir = publicDir;

} else if (

  fs.existsSync(

    path.join(rootDir, "index.html")

  )

) {

  frontendDir = rootDir;

}

if (frontendDir) {

  app.use(

    express.static(frontendDir)

  );

}

/* =========================================================

   HELPERS

========================================================= */

function createTimeout(ms = 60000) {

  return AbortSignal.timeout(ms);

}

function cleanMessages(messages) {

  if (!Array.isArray(messages)) {

    return [];

  }

  return messages

    .filter(

      (m) =>

        m &&

        (m.role === "user" ||

         m.role === "assistant") &&

        typeof m.content === "string" &&

        m.content.trim()

    )

    .map((m) => ({

      role: m.role,

      content: m.content.trim()

    }));

}

function getErrorMessage(data, fallback) {

  if (!data) {

    return fallback;

  }

  if (typeof data.error === "string") {

    return data.error;

  }

  if (

    data.error &&

    typeof data.error.message === "string"

  ) {

    return data.error.message;

  }

  if (

    typeof data.message === "string"

  ) {

    return data.message;

  }

  return fallback;

}

/* =========================================================

   HOME / HEALTH

========================================================= */

app.get("/", (req, res) => {

  if (frontendDir) {

    return res.sendFile(

      path.join(

        frontendDir,

        "index.html"

      )

    );

  }

  return res.json({

    ok: true,

    name: "ALWAFER AI",

    message: "ALWAFER AI backend is running",

    status: "online"

  });

});

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    name: "ALWAFER AI",

    status: "online",

    services: {

      gemini: Boolean(

        GEMINI_API_KEY

      ),

      openrouter: Boolean(

        OPENROUTER_API_KEY

      ),

      pixazo: Boolean(

        PIXAZO_API_KEY

      ),

      elevenlabs: Boolean(

        ELEVENLABS_API_KEY

      )

    }

  });

});

/* =========================================================

   MODELS

========================================================= */

app.get("/api/models", (req, res) => {

  res.json({

    defaultProvider:

      GEMINI_API_KEY

        ? "gemini"

        : "openrouter",

    gemini: [

      {

        id: "gemini-3.8-flash",

        name: "Gemini 3.8 Flash"

      },

      {

        id: "gemini-3.7-flash",

        name: "Gemini 3.7 Flash"

      },

      {

        id: "gemini-3.6-flash",

        name: "Gemini 3.6 Flash"

      },

      {

        id: "gemini-3.5-flash",

        name: "Gemini 3.5 Flash"

      },

      {

        id: "gemini-3.5-flash-lite",

        name: "Gemini 3.5 Flash Lite"

      },

      {

        id: "gemini-3.1-flash-lite",

        name: "Gemini 3.1 Flash Lite"

      }

    ],

    openrouter: [

      {

        id: "openrouter/free",

        name: "OpenRouter Free"

      }

    ],

    image: [

      {

        id: "flux",

        name: "FLUX"

      },

      {

        id: "sdxl",

        name: "Stable Diffusion XL"

      }

    ]

  });

});

/* =========================================================

   CHAT

========================================================= */

app.post(

  "/api/chat",

  async (req, res) => {

    try {

      const {

        messages,

        provider,

        model

      } = req.body;

      const clean =

        cleanMessages(messages);

      if (!clean.length) {

        return res.status(400).json({

          error:

            "لا توجد رسائل صالحة."

        });

      }

      /* =====================================================

         OPENROUTER

      ===================================================== */

      if (

        provider === "openrouter"

      ) {

        if (

          !OPENROUTER_API_KEY

        ) {

          return res.status(500).json({

            error:

              "OPENROUTER_API_KEY غير موجود في Render."

          });

        }

        const response =

          await fetch(

            "https://openrouter.ai/api/v1/chat/completions",

            {

              method: "POST",

              signal:

                createTimeout(90000),

              headers: {

                "Content-Type":

                  "application/json",

                "Authorization":

                  `Bearer ${OPENROUTER_API_KEY}`,

                "HTTP-Referer":

                  "https://zaka-ai-backend-1.onrender.com",

                "X-Title":

                  "ALWAFER AI"

              },

              body:

                JSON.stringify({

                  model:

                    OPENROUTER_MODEL,

                  messages:

                    clean

                })

            }

          );

        const data =

          await response.json();

        if (!response.ok) {

          return res.status(

            response.status

          ).json({

            error:

              getErrorMessage(

                data,

                "OpenRouter request failed"

              ),

            details: data

          });

        }

        const reply =

          data

            ?.choices?.[0]

            ?.message

            ?.content;

        if (!reply) {

          return res.status(500).json({

            error:

              "OpenRouter لم يرجع نصًا.",

            details: data

          });

        }

        return res.json({

          reply: String(reply)

        });

      }

      /* =====================================================

         GEMINI

      ===================================================== */

      if (

        provider !== "gemini" &&

        provider !== undefined &&

        provider !== null &&

        provider !== ""

      ) {

        return res.status(400).json({

          error:

            "مزود الذكاء الاصطناعي غير معروف."

        });

      }

      if (!GEMINI_API_KEY) {

        return res.status(500).json({

          error:

            "GEMINI_API_KEY غير موجود في Render."

        });

      }

      const selectedModel =

        typeof model === "string" &&

        model.trim()

          ? model.trim()

          : GEMINI_MODEL;

      const contents =

        clean.map((m) => ({

          role:

            m.role === "assistant"

              ? "model"

              : "user",

          parts: [

            {

              text: m.content

            }

          ]

        }));

      const response =

        await fetch(

          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(

            selectedModel

          )}:generateContent?key=${encodeURIComponent(

            GEMINI_API_KEY

          )}`,

          {

            method: "POST",

            signal:

              createTimeout(90000),

            headers: {

              "Content-Type":

                "application/json"

            },

            body:

              JSON.stringify({

                contents

              })

          }

        );

      const data =

        await response.json();

      if (!response.ok) {

        return res.status(

          response.status

        ).json({

          error:

            getErrorMessage(

              data,

              "Gemini request failed"

            ),

          details: data

        });

      }

      const parts =

        data

          ?.candidates?.[0]

          ?.content?.parts;

      const reply =

        Array.isArray(parts)

          ? parts

              .map(

                (p) =>

                  typeof p.text === "string"

                    ? p.text

                    : ""

              )

              .join("")

              .trim()

          : "";

      if (!reply) {

        return res.status(500).json({

          error:

            "Gemini لم يرجع نصًا.",

          details: data

        });

      }

      return res.json({

        reply

      });

    } catch (error) {

      console.error(

        "CHAT ERROR:",

        error

      );

      return res.status(500).json({

        error:

          error.name ===

          "TimeoutError"

            ? "انتهت مهلة الاتصال بالخدمة."

            : (

                error.message ||

                "حدث خطأ في السيرفر."

              )

      });

    }

  }

);

/* =========================================================

   IMAGE GENERATION

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

      } = req.body;

      if (!PIXAZO_API_KEY) {

        return res.status(500).json({

          error:

            "PIXAZO_API_KEY غير موجود في Render."

        });

      }

      if (

        typeof prompt !== "string" ||

        !prompt.trim()

      ) {

        return res.status(400).json({

          error:

            "اكتب وصف الصورة أولًا."

        });

      }

      const allowedModels = [

        "flux",

        "sdxl"

      ];

      if (

        !allowedModels.includes(model)

      ) {

        return res.status(400).json({

          error:

            "نموذج الصورة غير صالح."

        });

      }

      const allowedSizes = [

        [512, 512],

        [512, 896],

        [896, 512]

      ];

      const validSize =

        allowedSizes.some(

          ([w, h]) =>

            Number(width) === w &&

            Number(height) === h

        );

      if (!validSize) {

        return res.status(400).json({

          error:

            "مقاس الصورة غير صالح."

        });

      }

      let endpoint;

      let body;

      /* =====================================================

         FLUX

      ===================================================== */

      if (model === "flux") {

        endpoint =

          "https://gateway.pixazo.ai/flux-1-schnell/v1/getData";

        body = {

          prompt:

            prompt.trim(),

          num_steps: 4,

          seed:

            Math.floor(

              Math.random() *

              1000000

            ),

          width:

            Number(width),

          height:

            Number(height)

        };

      }

      /* =====================================================

         SDXL

      ===================================================== */

      if (model === "sdxl") {

        endpoint =

          "https://gateway.pixazo.ai/getImage/v1/getSDXLImage";

        body = {

          prompt:

            prompt.trim(),

          negative_prompt:

            "blurry, low quality, distorted, watermark, deformed",

          height:

            Number(height),

          width:

            Number(width),

          num_steps: 20,

          guidance_scale: 5,

          seed:

            Math.floor(

              Math.random() *

              1000000

            )

        };

      }

      const response =

        await fetch(

          endpoint,

          {

            method: "POST",

            signal:

              createTimeout(120000),

            headers: {

              "Content-Type":

                "application/json",

              "Ocp-Apim-Subscription-Key":

                PIXAZO_API_KEY

            },

            body:

              JSON.stringify(body)

          }

        );

      const data =

        await response.json();

      if (!response.ok) {

        return res.status(

          response.status

        ).json({

          error:

            getErrorMessage(

              data,

              "Pixazo image request failed"

            ),

          details: data

        });

      }

      const imageUrl =

        data?.imageUrl ||

        data?.output ||

        data?.image?.url ||

        data?.data?.imageUrl ||

        data?.data?.output ||

        data?.data?.image?.url;

      if (!imageUrl) {

        return res.status(500).json({

          error:

            "Pixazo لم يرجع رابط الصورة.",

          details: data

        });

      }

      return res.json({

        imageUrl

      });

    } catch (error) {

      console.error(

        "IMAGE ERROR:",

        error

      );

      return res.status(500).json({

        error:

          error.name ===

          "TimeoutError"

            ? "انتهت مهلة إنشاء الصورة."

            : (

                error.message ||

                "حدث خطأ أثناء إنشاء الصورة."

              )

      });

    }

  }

);

/* =========================================================

   VOICE - ELEVENLABS

========================================================= */

app.post(

  "/api/voice",

  async (req, res) => {

    try {

      const {

        text

      } = req.body;

      if (!ELEVENLABS_API_KEY) {

        return res.status(500).json({

          error:

            "ELEVENLABS_API_KEY غير موجود في Render."

        });

      }

      if (

        typeof text !== "string" ||

        !text.trim()

      ) {

        return res.status(400).json({

          error:

            "النص الصوتي فارغ."

        });

      }

      const cleanText =

        text

          .trim()

          .slice(0, 5000);

      const response =

        await fetch(

          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(

            ELEVENLABS_VOICE_ID

          )}?output_format=mp3_44100_128`,

          {

            method: "POST",

            signal:

              createTimeout(90000),

            headers: {

              "Content-Type":

                "application/json",

              "xi-api-key":

                ELEVENLABS_API_KEY

            },

            body:

              JSON.stringify({

                text:

                  cleanText,

                model_id:

                  "eleven_multilingual_v2"

              })

          }

        );

      if (!response.ok) {

        const errorText =

          await response.text();

        return res.status(

          response.status

        ).json({

          error:

            errorText ||

            "ElevenLabs request failed"

        });

      }

      const audioBuffer =

        await response.arrayBuffer();

      res.setHeader(

        "Content-Type",

        "audio/mpeg"

      );

      res.setHeader(

        "Content-Length",

        audioBuffer.byteLength

      );

      res.setHeader(

        "Cache-Control",

        "no-store"

      );

      return res.send(

        Buffer.from(audioBuffer)

      );

    } catch (error) {

      console.error(

        "VOICE ERROR:",

        error

      );

      return res.status(500).json({

        error:

          error.name ===

          "TimeoutError"

            ? "انتهت مهلة إنشاء الصوت."

            : (

                error.message ||

                "حدث خطأ أثناء إنشاء الصوت."

              )

      });

    }

  }

);

/* =========================================================

   VOICE STATUS

========================================================= */

app.get(

  "/api/voice-status",

  (req, res) => {

    res.json({

      configured:

        Boolean(

          ELEVENLABS_API_KEY

        ),

      voiceId:

        ELEVENLABS_VOICE_ID,

      provider:

        "ElevenLabs"

    });

  }

);

/* =========================================================

   404 API

========================================================= */

app.use(

  "/api",

  (req, res) => {

    res.status(404).json({

      error:

        "API endpoint غير موجود."

    });

  }

);

/* =========================================================

   FRONTEND FALLBACK

========================================================= */

if (frontendDir) {

  app.get(

    "*",

    (req, res) => {

      if (

        req.path.startsWith("/api/")

      ) {

        return res.status(404).json({

          error:

            "API endpoint غير موجود."

        });

      }

      return res.sendFile(

        path.join(

          frontendDir,

          "index.html"

        )

      );

    }

  );

}

/* =========================================================

   START SERVER

========================================================= */

app.listen(

  PORT,

  () => {

    console.log(

      "======================================"

    );

    console.log(

      "🚀 ALWAFER AI SERVER STARTED"

    );

    console.log(

      `🌐 PORT: ${PORT}`

    );

    console.log(

      `🤖 GEMINI: ${

        GEMINI_API_KEY

          ? "ON"

          : "OFF"

      }`

    );

    console.log(

      `🧠 OPENROUTER: ${

        OPENROUTER_API_KEY

          ? "ON"

          : "OFF"

      }`

    );

    console.log(

      `🎨 PIXAZO: ${

        PIXAZO_API_KEY

          ? "ON"

          : "OFF"

      }`

    );

    console.log(

      `🔊 ELEVENLABS: ${

        ELEVENLABS_API_KEY

          ? "ON"

          : "OFF"

      }`

    );

    console.log(

      "======================================"

    );

  }

);
