const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "ZAKA AI Backend يعمل بنجاح 🚀"
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "الرسالة فارغة"
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY غير موجود في Render"
      });
    }

    const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
    GEMINI_API_KEY,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: message
            }
          ]
        }
      ]
    })
  }
);

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.message ||
          "حدث خطأ من Gemini"
      });
    }

    const answer =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "لم يتم الحصول على رد.";

    res.json({
      answer
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "حدث خطأ في الخادم"
    });
  }
});

app.listen(PORT, () => {
  console.log(`ZAKA AI Backend يعمل على المنفذ ${PORT}`);
});
