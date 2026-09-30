require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const googleTTS = require('google-tts-api');

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الـ Middleware
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// 1. مسار المحادثة (Chat API) - استخدام النسخ الخفيفة والمجانية
// ----------------------------------------------------
app.post('/api/chat', async (req, res) => {
    const { provider, model, messages } = req.body;
    const lastMessage = messages[messages.length - 1].content;
    const isGemini = provider === 'gemini' || model.includes('gemini');

    try {
        let replyText = "";

        if (isGemini) {
            // استخدام نموذج جيميني الخفيف والمستقر
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
            
            const result = await generativeModel.generateContent(lastMessage);
            const response = await result.response;
            replyText = response.text();

        } else {
            // استخدام نموذج OpenRouter المجاني والخفيف
            const openRouterModel = "google/gemma-2-9b-it:free"; 
            
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: openRouterModel,
                    messages: messages,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                    }
                }
            );
            replyText = response.data.choices[0].message.content;
        }

        res.json({ reply: replyText });

    } catch (error) {
        console.error("CHAT ERROR:", error?.response?.data || error.message);
        res.status(500).json({ 
            error: "حدث خطأ في السيرفر أثناء جلب الرد. تأكد من صحة مفاتيح الـ API." 
        });
    }
});

// ----------------------------------------------------
// 2. مسار توليد الصور (Image API)
// ----------------------------------------------------
app.post('/api/image', async (req, res) => {
    const { prompt, width = 512, height = 512 } = req.body;

    try {
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

        await axios.get(imageUrl); 
        res.json({ imageUrl: imageUrl });
    } catch (error) {
        console.error("IMAGE ERROR:", error.message);
        res.status(500).json({ error: "فشل توليد الصورة، حاول بوصف مختلف." });
    }
});

// ----------------------------------------------------
// 3. مسار تحويل النص إلى صوت (Voice API)
// ----------------------------------------------------
app.post('/api/voice', async (req, res) => {
    const { text } = req.body;

    try {
        const url = googleTTS.getAudioUrl(text, {
            lang: 'ar',
            slow: false,
            host: 'https://translate.google.com',
        });

        const audioResponse = await axios.get(url, { responseType: 'arraybuffer' });
        
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioResponse.data);

    } catch (error) {
        console.error("VOICE ERROR:", error.message);
        res.status(500).json({ error: "فشل توليد الصوت." });
    }
});

// مسار فحص الحالة
app.get('/', (req, res) => {
    res.send("🚀 خادم الويفر AI يعمل بنجاح!");
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

