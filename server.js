const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PIXAZO_API_KEY = process.env.PIXAZO_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "ALWAFER AI backend is running"
  });
});


/* =========================
   CHAT
========================= */

app.post("/api/chat", async (req, res) => {
  try {

    const {
      messages,
      provider,
      model
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "messages is required"
      });
    }


    /* =========================
       OPENROUTER
    ========================= */

    if (provider === "openrouter") {

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({
          error:
            "OPENROUTER_API_KEY is missing"
        });
      }

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",

            "Authorization":
              `Bearer ${OPENROUTER_API_KEY}`,

            "HTTP-Referer":
              "https://zaka-ai-backend-1.onrender.com",

            "X-Title":
              "ALWAFER AI"
          },

          body: JSON.stringify({

            model:
              model ||
              "openrouter/free",

            messages:
              messages.map((m) => ({
                role: m.role,
                content: m.content
              }))

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
            data?.error?.message ||
            "OpenRouter request failed",

          details: data

        });
      }


      const reply =
        data?.choices?.[0]
          ?.message?.content || "";


      if (!reply) {

        return res.status(500).json({

          error:
            "OpenRouter returned an empty response",

          details: data

        });
      }


      return res.json({
        reply
      });

    }


    /* =========================
       GEMINI
    ========================= */

    if (!GEMINI_API_KEY) {

      return res.status(500).json({

        error:
          "GEMINI_API_KEY is missing"

      });
    }


    const contents =
      messages.map((m) => ({

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

        `https://generativelanguage.googleapis.com/v1beta/models/${model || GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,

        {

          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
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
          data?.error?.message ||
          "Gemini request failed",

        details: data

      });

    }


    const reply =
      data?.candidates?.[0]
        ?.content?.parts
        ?.map((p) => p.text || "")
        .join("") || "";


    if (!reply) {

      return res.status(500).json({

        error:
          "Gemini returned an empty response",

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
        error.message ||
        "Server error"

    });

  }
});


/* =========================
   IMAGE GENERATION
========================= */

app.post("/api/image", async (req, res) => {

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
          "PIXAZO_API_KEY is missing"

      });

    }


    if (!prompt) {

      return res.status(400).json({

        error:
          "prompt is required"

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
          w === width &&
          h === height

      );


    if (!validSize) {

      return res.status(400).json({

        error:
          "Invalid image size"

      });

    }


    let endpoint;

    let body;


    /* =========================
       SDXL
    ========================= */

    if (model === "sdxl") {

      endpoint =
        "https://gateway.pixazo.ai/getImage/v1/getSDXLImage";


      body = {

        prompt,

        negative_prompt:
          "blurry, low quality, distorted, watermark",

        height,

        width,

        num_steps: 20,

        guidance_scale: 5,

        seed:
          Math.floor(
            Math.random() *
            1000000
          )

      };

    }


    /* =========================
       FLUX
    ========================= */

    else {

      endpoint =
        "https://gateway.pixazo.ai/flux-1-schnell/v1/getData";


      body = {

        prompt,

        num_steps: 4,

        seed: 15,

        width,

        height

      };

    }


    const response =
      await fetch(

        endpoint,

        {

          method: "POST",

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
          data?.error?.message ||
          data?.message ||
          "Pixazo image request failed",

        details: data

      });

    }


    const imageUrl =

      data?.imageUrl ||

      data?.output ||

      data?.image?.url ||

      data?.data?.imageUrl ||

      data?.data?.output;


    if (!imageUrl) {

      return res.status(500).json({

        error:
          "Pixazo did not return an image URL",

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
        error.message ||
        "Server error"

    });

  }

});


/* =========================
   ELEVENLABS VOICE
========================= */

app.post("/api/voice", async (req, res) => {

  try {

    const { text } =
      req.body;


    if (!ELEVENLABS_API_KEY) {

      return res.status(500).json({

        error:
          "ELEVENLABS_API_KEY is missing"

      });

    }


    const voiceId =
      "JBFqnCBsd6RMkjVDRZzb";


    const response =
      await fetch(

        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "xi-api-key":
              ELEVENLABS_API_KEY

          },

          body:
            JSON.stringify({

              text,

              model_id:
                "eleven_multilingual_v2",

              output_format:
                "mp3_44100_128"

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


    res.send(
      Buffer.from(audioBuffer)
    );


  } catch (error) {

    console.error(
      "VOICE ERROR:",
      error
    );


    return res.status(500).json({

      error:
        error.message ||
        "Server error"

    });

  }

});


/* =========================
   VOICE STATUS
========================= */

app.get(
  "/api/voice-status",
  (req, res) => {

    res.json({

      configured:
        Boolean(
          ELEVENLABS_API_KEY
        )

    });

  }
);


/* =========================
   START SERVER
========================= */

app.listen(
  PORT,
  () => {

    console.log(
      `ALWAFER AI backend running on port ${PORT}`
    );

  }
);
