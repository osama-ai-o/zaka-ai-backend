
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY غير موجود"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },

        body: JSON.stringify({
          model: "gpt-5",
          input: message
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      return res.status(response.status).json({
        error: data.error?.message || "حدث خطأ من OpenAI"
      });

    }

    const answer =
      data.output_text ||
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

  console.log(
    `ZAKA AI Backend يعمل على المنفذ ${PORT}`
  );

});
