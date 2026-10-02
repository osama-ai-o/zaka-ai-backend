const express = require("express");

const cors = require("cors");

const axios = require("axios");

const dotenv = require("dotenv");

const multer = require("multer");

const fs = require("fs");

const path = require("path");

dotenv.config();

const app = express();

const PORT =

    process.env.PORT || 10000;

const FRONTEND_URL =

    process.env.FRONTEND_URL || "*";

/* =========================

   MIDDLEWARE

========================= */

app.use(

    cors({

        origin: FRONTEND_URL === "*"

            ? "*"

            : FRONTEND_URL

    })

);

app.use(

    express.json({

        limit: "10mb"

    })

);

app.use(

    express.urlencoded({

        extended: true,

        limit: "10mb"

    })

);

/* =========================

   UPLOADS

========================= */

const uploadDir =

    path.join(

        __dirname,

        "uploads"

    );

if (!fs.existsSync(uploadDir)) {

    fs.mkdirSync(

        uploadDir,

        { recursive: true }

    );

}

const upload =

    multer({

        dest: uploadDir,

        limits: {

            fileSize:

                10 * 1024 * 1024

        }

    });

/* =========================

   CONFIG

========================= */

const OPENAI_API_KEY =

    process.env.OPENAI_API_KEY;

const GEMINI_API_KEY =

    process.env.GEMINI_API_KEY;

const OPENROUTER_API_KEY =

    process.env.OPENROUTER_API_KEY;

const POLLINATIONS_API_KEY =

    process.env.POLLINATIONS_API_KEY;

const ELEVENLABS_API_KEY =

    process.env.ELEVENLABS_API_KEY;

const ELEVENLABS_VOICE_ID =

    process.env.ELEVENLABS_VOICE_ID;

/* =========================

   MODELS

========================= */

const OPENAI_MODEL =

    process.env.OPENAI_MODEL ||

    "gpt-5";

const GEMINI_MODEL =

    process.env.GEMINI_MODEL ||

    "gemini-3.8-flash";

const OPENROUTER_MODEL =

    process.env.OPENROUTER_MODEL ||

    "openai/gpt-5.4";

/* =========================

   HELPERS

========================= */

function cleanHistory(history) {

    if (!Array.isArray(history)) {

        return [];

    }

    return history

        .slice(-20)

        .filter(item =>

            item &&

            typeof item.content === "string"

        )

        .map(item => ({

            role:

                item.role === "assistant"

                    ? "assistant"

                    : "user",

            content:

                item.content

        }));

}

function buildPrompt(message, history) {

    const previous =

        cleanHistory(history);

    let prompt = "";

    if (previous.length) {

        prompt +=

            "سياق المحادثة السابقة:\n\n";

        previous.forEach(item => {

            prompt +=

                `${item.role}: ${item.content}\n\n`;

        });

    }

    prompt +=

        `رسالة المستخدم الحالية:\n${message}`;

    return prompt;

}

/* =========================

   OPENAI

========================= */

async function askOpenAI(

    message,

    history

) {

    if (!OPENAI_API_KEY) {

        throw new Error(

            "OPENAI_API_KEY غير موجود في Render."

        );

    }

    const input =

        buildPrompt(

            message,

            history

        );

    const response =

        await axios.post(

            "https://api.openai.com/v1/responses",

            {

                model: OPENAI_MODEL,

                instructions:

                    "أنت الويفر AI. أجب بالعربية عند استخدام العربية. كن دقيقًا ومفيدًا ومنظمًا.",

                input

            },

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENAI_API_KEY}`,

                    "Content-Type":

                        "application/json"

                },

                timeout: 120000

            }

        );

    const data =

        response.data;

    if (

        typeof data.output_text ===

        "string"

    ) {

        return data.output_text;

    }

    const output =

        Array.isArray(data.output)

            ? data.output

            : [];

    const text =

        output

            .flatMap(item =>

                Array.isArray(item.content)

                    ? item.content

                    : []

            )

            .map(item =>

                item.text || ""

            )

            .join("\n")

            .trim();

    return (

        text ||

        "لم يصل نص من OpenAI."

    );

}

/* =========================

   GEMINI

========================= */

async function askGemini(

    message,

    history

) {

    if (!GEMINI_API_KEY) {

        throw new Error(

            "GEMINI_API_KEY غير موجود في Render."

        );

    }

    const previous =

        cleanHistory(history);

    const contents = [];

    previous.forEach(item => {

        contents.push({

            role:

                item.role === "assistant"

                    ? "model"

                    : "user",

            parts: [

                {

                    text:

                        item.content

                }

            ]

        });

    });

    contents.push({

        role: "user",

        parts: [

            {

                text: message

            }

        ]

    });

    const url =

        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

    const response =

        await axios.post(

            url,

            {

                systemInstruction: {

                    parts: [

                        {

                            text:

                                "أنت الويفر AI. أجب بالعربية عند استخدام العربية. كن دقيقًا ومفيدًا ومنظمًا."

                        }

                    ]

                },

                contents,

                generationConfig: {

                    temperature: 0.7,

                    maxOutputTokens: 4096

                }

            },

            {

                headers: {

                    "x-goog-api-key":

                        GEMINI_API_KEY,

                    "Content-Type":

                        "application/json"

                },

                timeout: 120000

            }

        );

    const candidates =

        response.data &&

        response.data.candidates;

    if (!Array.isArray(candidates)) {

        return "لم يصل رد من Gemini.";

    }

    const text =

        candidates

            .flatMap(candidate =>

                candidate.content &&

                Array.isArray(

                    candidate.content.parts

                )

                    ? candidate.content.parts

                    : []

            )

            .map(part =>

                part.text || ""

            )

            .join("\n")

            .trim();

    return (

        text ||

        "لم يصل نص من Gemini."

    );

}

/* =========================

   OPENROUTER

========================= */

async function askOpenRouter(

    message,

    history

) {

    if (!OPENROUTER_API_KEY) {

        throw new Error(

            "OPENROUTER_API_KEY غير موجود في Render."

        );

    }

    const messages = [

        {

            role: "system",

            content:

                "أنت الويفر AI. أجب بالعربية عند استخدام العربية. كن دقيقًا ومفيدًا ومنظمًا."

        }

    ];

    cleanHistory(history)

        .forEach(item => {

            messages.push({

                role:

                    item.role === "assistant"

                        ? "assistant"

                        : "user",

                content:

                    item.content

            });

        });

    messages.push({

        role: "user",

        content: message

    });

    const response =

        await axios.post(

            "https://openrouter.ai/api/v1/chat/completions",

            {

                model:

                    OPENROUTER_MODEL,

                messages,

                temperature: 0.7,

                max_tokens: 4096

            },

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENROUTER_API_KEY}`,

                    "Content-Type":

                        "application/json",

                    "HTTP-Referer":

                        process.env.SITE_URL ||

                        "https://zaka-ai-backend-1.onrender.com",

                    "X-OpenRouter-Title":

                        "ALWAFER AI"

                },

                timeout: 120000

            }

        );

    return (

        response.data &&

        response.data.choices &&

        response.data.choices[0] &&

        response.data.choices[0].message &&

        response.data.choices[0].message.content

    ) || "لم يصل رد من OpenRouter.";

}

/* =========================

   HEALTH

========================= */

app.get(

    "/api/health",

    (req, res) => {

        res.json({

            ok: true,

            service:

                "ALWAFER AI Backend",

            version:

                "5.0.0",

            models: {

                openai:

                    Boolean(

                        OPENAI_API_KEY

                    ),

                gemini:

                    Boolean(

                        GEMINI_API_KEY

                    ),

                openrouter:

                    Boolean(

                        OPENROUTER_API_KEY

                    )

            },

            image:

                Boolean(

                    POLLINATIONS_API_KEY

                ),

            voice:

                Boolean(

                    ELEVENLABS_API_KEY

                )

        });

    }

);

/* =========================

   ROOT

========================= */

app.get(

    "/",

    (req, res) => {

        res.json({

            name: "ALWAFER AI",

            status: "online",

            version: "5.0.0"

        });

    }

);

/* =========================

   CHAT

========================= */

app.post(

    "/api/chat",

    async (req, res) => {

        try {

            const {

                message,

                model,

                history

            } = req.body;

            if (

                !message ||

                typeof message !== "string"

            ) {

                return res.status(400).json({

                    error:

                        "الرسالة مطلوبة."

                });

            }

            let reply;

            const selectedModel =

                model || "openai";

            if (

                selectedModel ===

                "openai"

            ) {

                reply =

                    await askOpenAI(

                        message,

                        history

                    );

            } else if (

                selectedModel ===

                "gemini"

            ) {

                reply =

                    await askGemini(

                        message,

                        history

                    );

            } else if (

                selectedModel ===

                "openrouter"

            ) {

                reply =

                    await askOpenRouter(

                        message,

                        history

                    );

            } else {

                return res.status(400).json({

                    error:

                        "النموذج غير معروف."

                });

            }

            res.json({

                ok: true,

                model: selectedModel,

                reply

            });

        } catch (error) {

            console.error(

                "CHAT ERROR:",

                error.response?.data ||

                error.message

            );

            const apiError =

                error.response?.data;

            res.status(500).json({

                ok: false,

                error:

                    apiError?.error?.message ||

                    apiError?.message ||

                    error.message ||

                    "حدث خطأ في الخادم."

            });

        }

    }

);

/* =========================

   IMAGE

========================= */

app.post(

    "/api/image",

    async (req, res) => {

        try {

            const {

                prompt,

                model,

                size

            } = req.body;

            if (

                !prompt ||

                typeof prompt !== "string"

            ) {

                return res.status(400).json({

                    error:

                        "وصف الصورة مطلوب."

                });

            }

            const selectedModel =

                model || "flux";

            const encodedPrompt =

                encodeURIComponent(

                    prompt

                );

            const params =

                new URLSearchParams();

            params.set(

                "model",

                selectedModel

            );

            if (size === "portrait") {

                params.set(

                    "width",

                    "768"

                );

                params.set(

                    "height",

                    "1365"

                );

            } else if (

                size === "landscape"

            ) {

                params.set(

                    "width",

                    "1365"

                );

                params.set(

                    "height",

                    "768"

                );

            } else {

                params.set(

                    "width",

                    "1024"

                );

                params.set(

                    "height",

                    "1024"

                );

            }

            if (POLLINATIONS_API_KEY) {

                params.set(

                    "key",

                    POLLINATIONS_API_KEY

                );

            }

            const imageUrl =

                `https://gen.pollinations.ai/image/${encodedPrompt}?${params.toString()}`;

            res.json({

                ok: true,

                image: imageUrl

            });

        } catch (error) {

            console.error(

                "IMAGE ERROR:",

                error.message

            );

            res.status(500).json({

                error:

                    "تعذر إنشاء رابط الصورة."

            });

        }

    }

);

/* =========================

   FILE ANALYSIS

========================= */

app.post(

    "/api/analyze-file",

    upload.single("file"),

    async (req, res) => {

        let filePath = null;

        try {

            if (!req.file) {

                return res.status(400).json({

                    error:

                        "لم يتم إرسال ملف."

                });

            }

            filePath =

                req.file.path;

            const originalName =

                req.file.originalname;

            const extension =

                path.extname(

                    originalName

                ).toLowerCase();

            const supportedText =

                [

                    ".txt",

                    ".md",

                    ".json",

                    ".js",

                    ".html",

                    ".css",

                    ".csv",

                    ".xml"

                ];

            if (

                supportedText.includes(

                    extension

                )

            ) {

                const content =

                    fs.readFileSync(

                        filePath,

                        "utf8"

                    );

                const limited =

                    content.slice(

                        0,

                        50000

                    );

                let analysis;

                if (GEMINI_API_KEY) {

                    analysis =

                        await askGemini(

                            `حلل هذا الملف "${originalName}" واشرح محتواه ووظيفته وأهم الملاحظات:\n\n${limited}`,

                            []

                        );

                } else if (

                    OPENAI_API_KEY

                ) {

                    analysis =

                        await askOpenAI(

                            `حلل هذا الملف "${originalName}" واشرح محتواه ووظيفته وأهم الملاحظات:\n\n${limited}`,

                            []

                        );

                } else {

                    analysis =

                        `تم استلام الملف ${originalName}.\n\n${limited}`;

                }

                return res.json({

                    ok: true,

                    filename:

                        originalName,

                    analysis

                });

            }

            if (extension === ".pdf") {

                return res.json({

                    ok: true,

                    filename:

                        originalName,

                    analysis:

                        "تم استلام ملف PDF. لإجراء تحليل نصي كامل للـPDF أضف محلل PDF إلى المشروع."

                });

            }

            return res.json({

                ok: true,

                filename:

                    originalName,

                analysis:

                    `تم استلام الملف ${originalName}. نوع الملف الحالي لا يدعم استخراج النص تلقائيًا في هذه النسخة.`

            });

        } catch (error) {

            console.error(

                "FILE ERROR:",

                error.response?.data ||

                error.message

            );

            res.status(500).json({

                error:

                    error.response?.data?.error?.message ||

                    error.message ||

                    "تعذر تحليل الملف."

            });

        } finally {

            if (

                filePath &&

                fs.existsSync(filePath)

            ) {

                try {

                    fs.unlinkSync(filePath);

                } catch {}

            }

        }

    }

);

/* =========================

   VOICE

========================= */

app.post(

    "/api/voice",

    async (req, res) => {

        try {

            const {

                text

            } = req.body;

            if (

                !text ||

                typeof text !== "string"

            ) {

                return res.status(400).json({

                    error:

                        "النص مطلوب."

                });

            }

            /* ElevenLabs */

            if (

                ELEVENLABS_API_KEY &&

                ELEVENLABS_VOICE_ID

            ) {

                const response =

                    await axios.post(

                        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}`,

                        {

                            text,

                            model_id:

                                "eleven_multilingual_v2",

                            language_code:

                                "ar"

                        },

                        {

                            headers: {

                                "xi-api-key":

                                    ELEVENLABS_API_KEY,

                                "Content-Type":

                                    "application/json",

                                Accept:

                                    "audio/mpeg"

                            },

                            responseType:

                                "arraybuffer",

                            timeout: 120000

                        }

                    );

                res.set(

                    "Content-Type",

                    "audio/mpeg"

                );

                return res.send(

                    response.data

                );

            }

            /* Google TTS */

            const googleTtsUrl =

                "https://translate.google.com/translate_tts";

            const response =

                await axios.get(

                    googleTtsUrl,

                    {

                        params: {

                            ie: "UTF-8",

                            q:

                                text.slice(

                                    0,

                                    200

                                ),

                            tl: "ar",

                            client: "tw-ob"

                        },

                        responseType:

                            "arraybuffer",

                        headers: {

                            "User-Agent":

                                "Mozilla/5.0"

                        }

                    }

                );

            res.set(

                "Content-Type",

                "audio/mpeg"

            );

            return res.send(

                response.data

            );

        } catch (error) {

            console.error(

                "VOICE ERROR:",

                error.response?.data ||

                error.message

            );

            res.status(500).json({

                error:

                    "تعذر إنشاء الصوت."

            });

        }

    }

);

/* =========================

   404

========================= */

app.use(

    (req, res) => {

        res.status(404).json({

            error:

                "المسار غير موجود."

        });

    }

);

/* =========================

   ERROR

========================= */

app.use(

    (error, req, res, next) => {

        console.error(

            "SERVER ERROR:",

            error

        );

        res.status(500).json({

            error:

                "حدث خطأ داخلي في الخادم."

        });

    }

);

/* =========================

   START

========================= */

app.listen(

    PORT,

    () => {

        console.log(

            `ALWAFER AI Backend running on port ${PORT}`

        );

        console.log(

            `OpenAI: ${Boolean(OPENAI_API_KEY)}`

        );

        console.log(

            `Gemini: ${Boolean(GEMINI_API_KEY)}`

        );

        console.log(

            `OpenRouter: ${Boolean(OPENROUTER_API_KEY)}`

        );

        console.log(

            `Pollinations: ${Boolean(POLLINATIONS_API_KEY)}`

        );

        console.log(

            `ElevenLabs: ${Boolean(ELEVENLABS_API_KEY)}`

        );

    }

);
