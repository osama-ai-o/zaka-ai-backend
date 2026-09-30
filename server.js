const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const DEFAULT_MODEL = "gemini-3.8-flash";


// ===============================
// الصفحة الرئيسية
// ===============================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    name: "ZAKA AI",
    message: "ZAKA AI Backend يعمل بنجاح 🚀"
  });

});


// ===============================
// قائمة النماذج
// ===============================

app.get("/api/models", (req, res) => {

  res.json([
    {
      id: "gemini-3.8-flash",
      name: "Gemini 3.8 Flash"
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
      id: "gemini-3.1-pro",
      name: "Gemini 3.1 Pro"
    }
  ]);

});


// ===============================
// المحادثة
// ===============================

app.post("/api/chat", async (req, res) => {

  try {

    const { message, model } = req.body;

    if (!message || !message.trim()) {

      return res.status(400).json({
        error: "الرسالة فارغة"
      });

    }


    if (!GEMINI_API_KEY) {

      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Render"
      });

    }


    const selectedModel =
      model || DEFAULT_MODEL;


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

      console.error("Gemini error:", data);

      return res.status(response.status).json({

        error:
          data.error?.message ||
          "حدث خطأ من Gemini"

      });

    }


    const answer =
      data.candidates?.[0]
        ?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();


    if (!answer) {

      return res.status(502).json({

        error: "Gemini لم يرجع نصًا."

      });

    }


    res.json({

      answer,

      model: selectedModel

    });


  } catch (error) {

    console.error("Server error:", error);


    res.status(500).json({

      error:
        "حدث خطأ داخلي في الخادم."

    });

  }

});


// ===============================
// تشغيل الخادم
// ===============================

app.listen(PORT, () => {

  console.log(
    `ZAKA AI Backend يعمل على المنفذ ${PORT}`
  );

});
