require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const googleTTS = require('google-tts-api'); // مكتبة لتحويل النص لصوت مجاناً

const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات الـ Middleware
app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// 1. مسار المحادثة (Chat API)
// ----------------------------------------------------
app.post('/api/chat', async (req, res) => {
    const { provider, model, messages } = req.body;

    // استخراج آخر رسالة من المستخدم
    const lastMessage = messages[messages.length - 1].content;
    const isGemini = provider === 'gemini' || model.includes('gemini');

    try {
        let replyText = "";

        if (isGemini) {
            // ---- استخدام Google Gemini ----
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // استخدمنا أحدث نموذج مستقر
            const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); 
            
            const result = await generativeModel.generateContent(lastMessage);
            const response = await result.response;
            replyText = response.text();

        } else {
            // ---- استخدام OpenRouter ----
            // نستخدم نموذج Gemma 2 المجاني والمستقر جداً كبديل افتراضي
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
        // نستخدم خدمة Pollinations المجانية الرائعة لتوليد الصور بدون API Key!
        // تقوم بإرجاع الصورة مباشرة بناءً على الوصف
        const encodedPrompt = encodeURIComponent(prompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

        // نتحقق من أن الرابط يعمل
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
        // استخدام مكتبة google-tts-api للحصول على رابط الصوت (يدعم العربية)
        const url = googleTTS.getAudioUrl(text, {
            lang: 'ar',
            slow: false,
            host: 'https://translate.google.com',
        });

        // جلب ملف الصوت من الرابط وإرساله للواجهة
        const audioResponse = await axios.get(url, { responseType: 'arraybuffer' });
        
        res.set('Content-Type', 'audio/mpeg');
        res.send(audioResponse.data);

    } catch (error) {
        console.error("VOICE ERROR:", error.message);
        res.status(500).json({ error: "فشل توليد الصوت." });
    }
});

// مسار فحص حالة السيرفر
app.get('/', (req, res) => {
    res.send("🚀 خادم الويفر AI يعمل بنجاح!");
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
