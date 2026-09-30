require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const googleTTS = require('google-tts-api');

const app = express();
const PORT = process.env.PORT || 3000;

// ================================
// إعدادات السيرفر
// ================================
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ================================
// الصفحة الرئيسية
// ================================
app.get('/', (req, res) => {
    res.send('🚀 خادم الويفر AI يعمل بنجاح!');
});

// ================================
// فحص حالة السيرفر
// ================================
app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        server: 'zaka-ai',
        gemini: !!process.env.GEMINI_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY
    });
});

// ============================================================
// GEMINI
// ============================================================
async function askGemini(messages) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY غير موجود في Render');
    }

    const genAI = new GoogleGenerativeAI(
        process.env.GEMINI_API_KEY
    );

    const modelName =
        process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    const generativeModel = genAI.getGenerativeModel({
        model: modelName
    });

    // نحول رسائل الموقع إلى صيغة Gemini
    const history = [];

    for (let i = 0; i < messages.length - 1; i++) {
        const msg = messages[i];

        if (!msg || !msg.content) continue;

        history.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [
                {
                    text: String(msg.content)
                }
            ]
        });
    }

    const lastMessage =
        messages[messages.length - 1]?.content || '';

    const chat = generativeModel.startChat({
        history
    });

    const result = await chat.sendMessage(
        String(lastMessage)
    );

    const response = await result.response;

    return response.text();
}

// ============================================================
// OPENROUTER
// ============================================================
async function askOpenRouter(messages) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY غير موجود في Render');
    }

    // هذا يجعل OpenRouter يختار نموذجًا مجانيًا متاحًا
    const openRouterModel = 'openrouter/free';

    const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            model: openRouterModel,
            messages: messages.map(msg => ({
                role:
                    msg.role === 'assistant'
                        ? 'assistant'
                        : 'user',
                content: String(msg.content || '')
            }))
        },
        {
            headers: {
                Authorization:
                    `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer':
                    'https://zaka-ai-backend-1.onrender.com',
                'X-Title': 'Alwafer AI'
            },
            timeout: 60000
        }
    );

    const reply =
        response.data?.choices?.[0]?.message?.content;

    if (!reply) {
        throw new Error(
            'OpenRouter لم يرجع نصًا صالحًا'
        );
    }

    return reply;
}

// ============================================================
// CHAT API
// ============================================================
app.post('/api/chat', async (req, res) => {
    try {
        const {
            provider,
            model,
            messages
        } = req.body;

        // التأكد من وجود الرسائل
        if (
            !Array.isArray(messages) ||
            messages.length === 0
        ) {
            return res.status(400).json({
                error: 'الرسائل غير موجودة'
            });
        }

        console.log(
            '💬 Chat request:',
            {
                provider,
                model,
                messages: messages.length
            }
        );

        // ==================================================
        // المستخدم اختار Gemini
        // ==================================================
        if (
            provider === 'gemini' ||
            String(model || '').includes('gemini')
        ) {
            try {
                const reply = await askGemini(messages);

                console.log('✅ Gemini response');

                return res.json({
                    reply,
                    provider: 'gemini',
                    model:
                        process.env.GEMINI_MODEL ||
                        'gemini-3.8-flash'
                });

            } catch (geminiError) {

                const geminiStatus =
                    geminiError?.status ||
                    geminiError?.response?.status ||
                    geminiError?.code;

                const geminiMessage =
                    geminiError?.message ||
                    'Gemini error';

                console.error(
                    '❌ Gemini ERROR:',
                    geminiMessage
                );

                // إذا كانت المشكلة حصة / 429
                const isQuotaError =
                    geminiStatus === 429 ||
                    geminiMessage.includes('429') ||
                    geminiMessage
                        .toLowerCase()
                        .includes('quota') ||
                    geminiMessage
                        .toLowerCase()
                        .includes('resource_exhausted');

                if (isQuotaError) {
                    console.log(
                        '⚠️ Gemini quota exceeded → switching to OpenRouter'
                    );

                    try {
                        const reply =
                            await askOpenRouter(messages);

                        console.log(
                            '✅ OpenRouter fallback response'
                        );

                        return res.json({
                            reply,
                            provider: 'openrouter',
                            model: 'openrouter/free',
                            fallback: true
                        });

                    } catch (openRouterError) {

                        console.error(
                            '❌ OpenRouter fallback ERROR:',
                            openRouterError?.response?.data ||
                            openRouterError?.message
                        );

                        return res.status(503).json({
                            error:
                                'انتهت حصة Gemini، وOpenRouter لم يتمكن من الرد.',
                            geminiError:
                                geminiMessage,
                            openRouterError:
                                openRouterError?.response?.data ||
                                openRouterError?.message
                        });
                    }
                }

                // خطأ Gemini غير متعلق بالحصة
                return res.status(500).json({
                    error:
                        'حدث خطأ في Gemini',
                    details:
                        geminiMessage
                });
            }
        }

        // ==================================================
        // المستخدم اختار OpenRouter
        // ==================================================
        try {
            const reply =
                await askOpenRouter(messages);

            console.log(
                '✅ OpenRouter response'
            );

            return res.json({
                reply,
                provider: 'openrouter',
                model: 'openrouter/free'
            });

        } catch (openRouterError) {

            console.error(
                '❌ OpenRouter ERROR:',
                openRouterError?.response?.data ||
                openRouterError?.message
            );

            return res.status(500).json({
                error:
                    'حدث خطأ في OpenRouter',
                details:
                    openRouterError?.response?.data ||
                    openRouterError?.message
            });
        }

    } catch (error) {

        console.error(
            '❌ CHAT ERROR:',
            error?.response?.data ||
            error?.message
        );

        return res.status(500).json({
            error:
                'حدث خطأ أثناء الاتصال بالسيرفر',
            details:
                error?.response?.data ||
                error?.message
        });
    }
});

// ============================================================
// IMAGE API
// ============================================================
app.post('/api/image', async (req, res) => {

    const {
        prompt,
        width = 512,
        height = 512
    } = req.body;

    if (!prompt || !String(prompt).trim()) {
        return res.status(400).json({
            error: 'وصف الصورة فارغ'
        });
    }

    try {

        const encodedPrompt =
            encodeURIComponent(
                String(prompt)
            );

        const imageUrl =
            `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

        await axios.get(imageUrl, {
            timeout: 60000
        });

        return res.json({
            imageUrl
        });

    } catch (error) {

        console.error(
            '❌ IMAGE ERROR:',
            error?.response?.data ||
            error?.message
        );

        return res.status(500).json({
            error:
                'فشل توليد الصورة، حاول بوصف مختلف.'
        });
    }
});

// ============================================================
// VOICE API
// ============================================================
app.post('/api/voice', async (req, res) => {

    const { text } = req.body;

    if (!text || !String(text).trim()) {
        return res.status(400).json({
            error: 'النص فارغ'
        });
    }

    try {

        const url =
            googleTTS.getAudioUrl(
                String(text),
                {
                    lang: 'ar',
                    slow: false,
                    host:
                        'https://translate.google.com'
                }
            );

        const audioResponse =
            await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

        res.set(
            'Content-Type',
            'audio/mpeg'
        );

        return res.send(
            audioResponse.data
        );

    } catch (error) {

        console.error(
            '❌ VOICE ERROR:',
            error?.message
        );

        return res.status(500).json({
            error:
                'فشل توليد الصوت.'
        });
    }
});

// ============================================================
// تشغيل السيرفر
// ============================================================
app.listen(PORT, () => {

    console.log(
        `🚀 Server running on port ${PORT}`
    );

    console.log(
        'Gemini:',
        process.env.GEMINI_API_KEY
            ? 'Configured'
            : 'Missing'
    );

    console.log(
        'OpenRouter:',
        process.env.OPENROUTER_API_KEY
            ? 'Configured'
            : 'Missing'
    );
});
