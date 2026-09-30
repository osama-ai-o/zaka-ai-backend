const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

// ======================================
// API KEYS
// ======================================

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY;

const PIXAZO_API_KEY =
  process.env.PIXAZO_API_KEY;

const ELEVENLABS_API_KEY =
  process.env.ELEVENLABS_API_KEY;


// ======================================
// MODELS
// ======================================

const DEFAULT_MODEL =
  "gemini-3.8-flash";


// ======================================
// HOME
// ======================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    name: "ZAKA AI",
    message:
      "ZAKA AI Backend يعمل بنجاح 🚀"
  });

});


// ======================================
// CHAT
// ======================================

app.post("/api/chat", async (req, res) => {

  try {

    const {
      message,
      provider,
      model
    } = req.body;


    if (
      !message ||
      !message.trim()
    ) {

      return res.status(400).json({
        error: "الرسالة فارغة"
      });

    }


    // ==================================
    // GEMINI
    // ==================================

    if (
      !provider ||
      provider === "gemini"
    ) {

      if (!GEMINI_API_KEY) {

        return res.status(500).json({
          error:
            "GEMINI_API_KEY غير موجود في Render"
        });

      }


      const selectedModel =
        model || DEFAULT_MODEL;


      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;


      const response =
        await fetch(url, {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              GEMINI_API_KEY
          },

          body:
            JSON.stringify({

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


      const data =
        await response.json();


      if (!response.ok) {

        console.error(
          "Gemini:",
          data
        );

        return res.status(
          response.status
        ).json({

          error:
            data?.error?.message ||
            "Gemini API Error"

        });

      }


      const answer =
        data
          ?.candidates?.[0]
          ?.content?.parts
          ?.map(
            part =>
              part.text || ""
          )
          .join("")
          .trim();


      if (!answer) {

        return res.status(502).json({

          error:
            "Gemini لم يرجع نصًا"

        });

      }


      return res.json({

        answer,

        provider: "gemini",

        model:
          selectedModel

      });

    }


    // ==================================
    // OPENROUTER
    // ==================================

    if (
      provider ===
      "openrouter"
    ) {

      if (!OPENROUTER_API_KEY) {

        return res.status(500).json({

          error:
            "OPENROUTER_API_KEY غير موجود في Render"

        });

      }


      const selectedModel =
        model ||
        "openrouter/free";


      const response =
        await fetch(

          "https://openrouter.ai/api/v1/chat/completions",

          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Authorization":
                `Bearer ${OPENROUTER_API_KEY}`,

              "HTTP-Referer":
                "https://zaka-ai-backend-1.onrender.com",

              "X-Title":
                "ZAKA AI"

            },

            body:
              JSON.stringify({

                model:
                  selectedModel,

                messages: [

                  {

                    role: "user",

                    content:
                      message

                  }

                ]

              })

          }

        );


      const data =
        await response.json();


      console.log(
        "OpenRouter:",
        response.status,
        JSON.stringify(data)
      );


      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          error:
            data?.error?.message ||
            `OpenRouter HTTP ${response.status}`

        });

      }


      const answer =
        data
          ?.choices?.[0]
          ?.message?.content;


      if (!answer) {

        return res.status(502).json({

          error:
            "OpenRouter لم يرجع نصًا"

        });

      }


      return res.json({

        answer,

        provider:
          "openrouter",

        model:
          selectedModel

      });

    }


    return res.status(400).json({

      error:
        "مزود الذكاء الاصطناعي غير معروف"

    });


  } catch (error) {

    console.error(
      "SERVER ERROR:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "خطأ داخلي في الخادم"

    });

  }

});


// ======================================
// IMAGE - PIXAZO
// ======================================

app.post("/api/image", async (req, res) => {

  try {

    const {
      prompt,
      width,
      height
    } = req.body;


    if (
      !prompt ||
      !prompt.trim()
    ) {

      return res.status(400).json({

        error:
          "وصف الصورة فارغ"

      });

    }


    if (!PIXAZO_API_KEY) {

      return res.status(500).json({

        error:
          "PIXAZO_API_KEY غير موجود في Render"

      });

    }


    let imageWidth =
      Number(width) || 512;

    let imageHeight =
      Number(height) || 512;


    const allowedSizes = [

      [512, 512],

      [512, 896],

      [896, 512]

    ];


    const validSize =
      allowedSizes.some(
        ([w, h]) =>
          w === imageWidth &&
          h === imageHeight
      );


    if (!validSize) {

      imageWidth = 512;

      imageHeight = 512;

    }


    const response =
      await fetch(

        "https://gateway.pixazo.ai/flux-1-schnell/v1/getData",

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Cache-Control":
              "no-cache",

            "Ocp-Apim-Subscription-Key":
              PIXAZO_API_KEY

          },

          body:
            JSON.stringify({

              prompt:
                prompt.trim(),

              num_steps: 4,

              seed: 15,

              width:
                imageWidth,

              height:
                imageHeight

            })

        }

      );


    const text =
      await response.text();


    console.log(
      "Pixazo:",
      response.status,
      text
    );


    let data;


    try {

      data =
        JSON.parse(text);

    } catch {

      return res.status(
        response.status
      ).json({

        error:
          text ||
          `Pixazo HTTP ${response.status}`

      });

    }


    if (!response.ok) {

      return res.status(
        response.status
      ).json({

        error:
          data?.message ||
          data?.error ||
          `Pixazo HTTP ${response.status}`

      });

    }


    const imageUrl =
      data?.output;


    if (!imageUrl) {

      return res.status(502).json({

        error:
          "Pixazo لم يرجع رابط الصورة",

        pixazo:
          data

      });

    }


    return res.json({

      success: true,

      imageUrl,

      provider:
        "pixazo",

      width:
        imageWidth,

      height:
        imageHeight

    });


  } catch (error) {

    console.error(
      "PIXAZO ERROR:",
      error
    );


    return res.status(500).json({

      error:
        error?.message ||
        "حدث خطأ أثناء إنشاء الصورة"

    });

  }

});


// ======================================
// VOICE - ELEVENLABS
// ======================================

app.post("/api/voice", async (req, res) => {

  try {

    const {
      text
    } = req.body;


    if (
      !text ||
      !text.trim()
    ) {

      return res.status(400).json({

        error:
          "النص فارغ"

      });

    }


    if (!ELEVENLABS_API_KEY) {

      return res.status(500).json({

        error:
          "ELEVENLABS_API_KEY غير موجود في Render"

      });

    }


    // Voice ID موثق في مثال ElevenLabs الحالي
    const voiceId =
      "JBFqnCBsd6RMkjVDRZzb";


    const url =
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;


    const response =
      await fetch(url, {

        method: "POST",

        headers: {

          "xi-api-key":
            ELEVENLABS_API_KEY,

          "Content-Type":
            "application/json"

        },

        body:
          JSON.stringify({

            text:
              text.trim(),

            model_id:
              "eleven_multilingual_v2"

          })

      });


    if (!response.ok) {

      const errorText =
        await response.text();


      console.error(
        "ElevenLabs:",
        response.status,
        errorText
      );


      return res.status(
        response.status
      ).json({

        error:
          `ElevenLabs HTTP ${response.status}: ${errorText}`

      });

    }


    const audioBuffer =
      Buffer.from(
        await response.arrayBuffer()
      );


    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );


    res.setHeader(
      "Content-Length",
      audioBuffer.length
    );


    res.setHeader(
      "Cache-Control",
      "no-cache"
    );


    return res.send(
      audioBuffer
    );


  } catch (error) {

    console.error(
      "VOICE ERROR:",
      error
    );


    return res.status(500).json({

      error:
        error?.message ||
        "حدث خطأ أثناء إنشاء الصوت"

    });

  }

});


// ======================================
// TEST VOICE
// ======================================

app.get("/api/voice-status", (req, res) => {

  res.json({

    voice:
      "ElevenLabs",

    configured:
      Boolean(ELEVENLABS_API_KEY),

    endpoint:
      "/api/voice"

  });

});


// ======================================
// START SERVER
// ======================================

app.listen(
  PORT,
  () => {

    console.log(
      `ZAKA AI Backend يعمل على المنفذ ${PORT}`
    );

  }
);
