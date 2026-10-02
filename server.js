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

app.use(

    cors({

        origin: "*"

    })

);

app.use(

    express.json({

        limit: "30mb"

    })

);

app.use(

    express.urlencoded({

        extended: true,

        limit: "30mb"

    })

);

const upload =

    multer({

        dest: "/tmp/alwafer/"

    });

/* ENV */

const OPENAI_API_KEY =

    process.env.OPENAI_API_KEY || "";

const OPENAI_MODEL =

    process.env.OPENAI_MODEL ||

    "gpt-5.6";

const OPENAI_IMAGE_MODEL =

    process.env.OPENAI_IMAGE_MODEL ||

    "gpt-image-2.5-flare";

const GEMINI_API_KEY =

    process.env.GEMINI_API_KEY || "";

const GEMINI_MODEL =

    process.env.GEMINI_MODEL ||

    "gemini-3.6-flash";

const OPENROUTER_API_KEY =

    process.env.OPENROUTER_API_KEY || "";

const OPENROUTER_MODEL =

    process.env.OPENROUTER_MODEL ||

    "openai/gpt-5.2";

const PIXAZO_API_KEY =

    process.env.PIXAZO_API_KEY || "";

const ELEVENLABS_API_KEY =

    process.env.ELEVENLABS_API_KEY || "";

const ELEVENLABS_VOICE_ID =

    process.env.ELEVENLABS_VOICE_ID ||

    "21m00Tcm4TlvDq8ikWAM";

/* HELPERS */

function apiError(error) {

    const data =

        error?.response?.data;

    if (typeof data === "string") {

        return data;

    }

    return (

        data?.error?.message ||

        data?.error ||

        data?.message ||

        error?.message ||

        "Unknown API error"

    );

}

function cleanHistory(history) {

    if (!Array.isArray(history)) {

        return [];

    }

    return history

        .slice(-20)

        .filter(item =>

            item &&

            typeof item.content === "string" &&

            (

                item.role === "user" ||

                item.role === "assistant"

            )

        );

}

/* ROOT */

app.get("/", (req,res) => {

    res.json({

        name: "ALWAFER AI",

        version: "8.0.0",

        status: "online"

    });

});

/* HEALTH */

app.get(

    "/api/health",

    (req,res) => {

        res.json({

            ok: true,

            services: {

                openai:

                    Boolean(OPENAI_API_KEY),

                gemini:

                    Boolean(GEMINI_API_KEY),

                openrouter:

                    Boolean(OPENROUTER_API_KEY),

                pixazo:

                    Boolean(PIXAZO_API_KEY),

                elevenlabs:

                    Boolean(ELEVENLABS_API_KEY)

            },

            models: {

                openai:

                    OPENAI_MODEL,

                openaiImage:

                    OPENAI_IMAGE_MODEL,

                gemini:

                    GEMINI_MODEL,

                openrouter:

                    OPENROUTER_MODEL

            }

        });

    }

);

/* =========================

   OPENAI CHAT

========================= */

async function openAIChat(

    message,

    history

) {

    if (!OPENAI_API_KEY) {

        throw new Error(

            "OPENAI_API_KEY غير موجود"

        );

    }

    const input = [

        ...cleanHistory(history)

            .map(item => ({

                role:

                    item.role,

                content:

                    item.content

            })),

        {

            role: "user",

            content: message

        }

    ];

    const response =

        await axios.post(

            "https://api.openai.com/v1/responses",

            {

                model:

                    OPENAI_MODEL,

                instructions:

                    "أنت ALWAFER AI. أجب بالعربية افتراضيًا. كن دقيقًا وواضحًا ومنظمًا.",

                input

            },

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENAI_API_KEY}`,

                    "Content-Type":

                        "application/json"

                },

                timeout: 180000

            }

        );

    if (response.data?.output_text) {

        return response.data.output_text;

    }

    let text = "";

    for (

        const output of

        response.data?.output || []

    ) {

        for (

            const part of

            output.content || []

        ) {

            if (

                part.type === "output_text"

            ) {

                text +=

                    part.text || "";

            }

        }

    }

    if (!text) {

        throw new Error(

            "OpenAI لم يرجع نصًا"

        );

    }

    return text;

}

/* =========================

   GEMINI CHAT

========================= */

async function geminiChat(

    message,

    history

) {

    if (!GEMINI_API_KEY) {

        throw new Error(

            "GEMINI_API_KEY غير موجود"

        );

    }

    const contents =

        cleanHistory(history)

            .map(item => ({

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

            }));

    contents.push({

        role: "user",

        parts: [

            {

                text: message

            }

        ]

    });

    const url =

        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(

            GEMINI_MODEL

        )}:generateContent`;

    const response =

        await axios.post(

            url,

            {

                systemInstruction: {

                    parts: [

                        {

                            text:

                                "أنت ALWAFER AI. أجب بالعربية افتراضيًا. كن دقيقًا ومنظمًا."

                        }

                    ]

                },

                contents,

                generationConfig: {

                    temperature: 0.7,

                    maxOutputTokens: 8192

                }

            },

            {

                headers: {

                    "x-goog-api-key":

                        GEMINI_API_KEY,

                    "Content-Type":

                        "application/json"

                },

                timeout: 180000

            }

        );

    const parts =

        response.data

            ?.candidates?.[0]

            ?.content?.parts || [];

    const text =

        parts

            .map(

                part =>

                    part.text || ""

            )

            .join("");

    if (!text) {

        throw new Error(

            "Gemini لم يرجع نصًا"

        );

    }

    return text;

}

/* =========================

   OPENROUTER CHAT

========================= */

async function openRouterChat(

    message,

    history

) {

    if (!OPENROUTER_API_KEY) {

        throw new Error(

            "OPENROUTER_API_KEY غير موجود"

        );

    }

    const messages = [

        {

            role: "system",

            content:

                "أنت ALWAFER AI. أجب بالعربية افتراضيًا. كن دقيقًا وواضحًا."

        },

        ...cleanHistory(history),

        {

            role: "user",

            content: message

        }

    ];

    const response =

        await axios.post(

            "https://openrouter.ai/api/v1/chat/completions",

            {

                model:

                    OPENROUTER_MODEL,

                messages,

                temperature: 0.7,

                max_tokens: 8192

            },

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENROUTER_API_KEY}`,

                    "Content-Type":

                        "application/json",

                    "X-Title":

                        "ALWAFER AI"

                },

                timeout: 180000

            }

        );

    const text =

        response.data

            ?.choices?.[0]

            ?.message?.content;

    if (!text) {

        throw new Error(

            "OpenRouter لم يرجع نصًا"

        );

    }

    return text;

}

/* CHAT ROUTE */

app.post(

    "/api/chat",

    async (req,res) => {

        try {

            const {

                model,

                message,

                history

            } = req.body;

            if (

                !message ||

                typeof message !== "string"

            ) {

                return res.status(400).json({

                    error:

                        "الرسالة مطلوبة"

                });

            }

            let answer;

            if (model === "gemini") {

                answer =

                    await geminiChat(

                        message,

                        history

                    );

            } else if (

                model === "openrouter"

            ) {

                answer =

                    await openRouterChat(

                        message,

                        history

                    );

            } else {

                answer =

                    await openAIChat(

                        message,

                        history

                    );

            }

            res.json({

                answer

            });

        } catch (error) {

            console.error(

                "CHAT ERROR",

                error?.response?.data ||

                error.message

            );

            res.status(

                error?.response?.status || 500

            ).json({

                error:

                    apiError(error)

            });

        }

    }

);

/* =========================

   OPENROUTER IMAGE MODELS

========================= */

app.get(

    "/api/image-models/openrouter",

    async (req,res) => {

        try {

            if (!OPENROUTER_API_KEY) {

                return res.status(400).json({

                    error:

                        "OPENROUTER_API_KEY غير موجود"

                });

            }

            const response =

                await axios.get(

                    "https://openrouter.ai/api/v1/images/models",

                    {

                        headers: {

                            Authorization:

                                `Bearer ${OPENROUTER_API_KEY}`

                        },

                        timeout: 60000

                    }

                );

            res.json({

                models:

                    response.data?.data || []

            });

        } catch (error) {

            console.error(

                "IMAGE MODELS ERROR",

                error?.response?.data ||

                error.message

            );

            res.status(

                error?.response?.status || 500

            ).json({

                error:

                    apiError(error)

            });

        }

    }

);

/* =========================

   OPENAI IMAGE

========================= */

async function openAIImage(

    prompt,

    model,

    size,

    quality,

    n

) {

    if (!OPENAI_API_KEY) {

        throw new Error(

            "OPENAI_API_KEY غير موجود"

        );

    }

    const body = {

        model:

            model ||

            OPENAI_IMAGE_MODEL,

        prompt,

        size:

            size ||

            "1024x1024",

        n:

            Math.min(

                Math.max(

                    Number(n) || 1,

                    1

                ),

                4

            )

    };

    if (

        quality &&

        quality !== "auto"

    ) {

        body.quality =

            quality;

    }

    const response =

        await axios.post(

            "https://api.openai.com/v1/images/generations",

            body,

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENAI_API_KEY}`,

                    "Content-Type":

                        "application/json"

                },

                timeout: 300000

            }

        );

    return (

        response.data?.data || []

    )

        .map(item => {

            if (item.b64_json) {

                return {

                    dataUrl:

                        `data:image/png;base64,${item.b64_json}`

                };

            }

            if (item.url) {

                return {

                    url:

                        item.url

                };

            }

            return null;

        })

        .filter(Boolean);

}

/* =========================

   OPENROUTER IMAGE

========================= */

async function openRouterImage(

    prompt,

    model,

    aspect,

    resolution,

    quality,

    n

) {

    if (!OPENROUTER_API_KEY) {

        throw new Error(

            "OPENROUTER_API_KEY غير موجود"

        );

    }

    if (!model) {

        throw new Error(

            "اختر نموذج OpenRouter"

        );

    }

    const body = {

        model,

        prompt,

        n:

            Math.min(

                Math.max(

                    Number(n) || 1,

                    1

                ),

                10

            ),

        aspect_ratio:

            aspect || "1:1",

        resolution:

            resolution || "1K",

        output_format:

            "png"

    };

    if (

        quality &&

        quality !== "auto"

    ) {

        body.quality =

            quality;

    }

    const response =

        await axios.post(

            "https://openrouter.ai/api/v1/images",

            body,

            {

                headers: {

                    Authorization:

                        `Bearer ${OPENROUTER_API_KEY}`,

                    "Content-Type":

                        "application/json",

                    "X-Title":

                        "ALWAFER AI"

                },

                timeout: 300000

            }

        );

    return (

        response.data?.data || []

    )

        .map(item => {

            if (item.b64_json) {

                return {

                    dataUrl:

                        `data:${item.media_type || "image/png"};base64,${item.b64_json}`

                };

            }

            if (item.url) {

                return {

                    url:

                        item.url

                };

            }

            return null;

        })

        .filter(Boolean);

}

/* =========================

   GEMINI IMAGE

========================= */

async function geminiImage(

    prompt,

    model,

    aspect,

    resolution

) {

    if (!GEMINI_API_KEY) {

        throw new Error(

            "GEMINI_API_KEY غير موجود"

        );

    }

    const imageModel =

        model ||

        "gemini-3.1-flash-image";

    const response =

        await axios.post(

            "https://generativelanguage.googleapis.com/v1beta/interactions",

            {

                model:

                    imageModel,

                input:

                    prompt,

                response_format: {

                    type:

                        "image",

                    mime_type:

                        "image/png",

                    aspect_ratio:

                        aspect || "1:1",

                    image_size:

                        resolution || "1K"

                }

            },

            {

                headers: {

                    "x-goog-api-key":

                        GEMINI_API_KEY,

                    "Content-Type":

                        "application/json"

                },

                timeout: 300000

            }

        );

    const image =

        response.data?.output_image;

    if (

        !image ||

        !image.data

    ) {

        throw new Error(

            "Gemini لم يرجع صورة"

        );

    }

    return [

        {

            dataUrl:

                `data:${image.mime_type || "image/png"};base64,${image.data}`

        }

    ];

}

/* =========================

   PIXAZO

========================= */

function pixazoModelToEndpoint(

    model

) {

    const map = {

        "gpt-image-2.5-flare":

            "gpt-image-2-5-flare/v1/text-to-image",

        "gpt-image-2.5-sunburst":

            "gpt-image-2-5-sunburst/v1/text-to-image",

        "gpt-image-2":

            "gpt-image-2/v1/text-to-image",

        "nano-banana-pro":

            "nano-banana-pro/v1/text-to-image",

        "nano-banana-2":

            "nano-banana-2/v1/text-to-image",

        "qwen-image-3-0-pro":

            "qwen-image-3-0-pro/v1/text-to-image",

        "krea-2-large":

            "krea-2-large/v1/text-to-image",

        "grok-imagine-image-v2":

            "grok-imagine-image-v2/v1/text-to-image",

        "reve-image-2-1":

            "reve-image-2-1/v1/text-to-image",

        "flux":

            "flux/text-to-image",

        "sdxl":

            "sdxl/text-to-image",

        "z-image":

            "z-image/v1/text-to-image"

    };

    return (

        map[model] ||

        `${model}/v1/text-to-image`

    );

}

function aspectToSize(

    aspect

) {

    const sizes = {

        "1:1":

            "1024x1024",

        "16:9":

            "1536x864",

        "9:16":

            "864x1536",

        "4:3":

            "1536x1152",

        "3:4":

            "1152x1536",

        "3:2":

            "1536x1024",

        "2:3":

            "1024x1536"

    };

    return (

        sizes[aspect] ||

        "1024x1024"

    );

}

async function pollPixazo(

    pollingUrl

) {

    for (

        let i = 0;

        i < 90;

        i++

    ) {

        await new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    4000

                )

        );

        const response =

            await axios.get(

                pollingUrl,

                {

                    headers: {

                        "Ocp-Apim-Subscription-Key":

                            PIXAZO_API_KEY

                    },

                    timeout: 60000

                }

            );

        const data =

            response.data;

        const status =

            String(

                data?.status || ""

            ).toUpperCase();

        if (

            status === "COMPLETED"

        ) {

            const url =

                data?.output?.media_url ||

                data?.output?.url ||

                data?.media_url ||

                data?.url;

            if (!url) {

                throw new Error(

                    "Pixazo اكتمل بدون رابط صورة"

                );

            }

            return [

                {

                    url

                }

            ];

        }

        if (

            status === "FAILED" ||

            status === "ERROR"

        ) {

            throw new Error(

                data?.error ||

                "Pixazo فشل في إنشاء الصورة"

            );

        }

    }

    throw new Error(

        "انتهت مهلة Pixazo"

    );

}

async function pixazoImage(

    prompt,

    model,

    aspect,

    resolution,

    quality,

    n

) {

    if (!PIXAZO_API_KEY) {

        throw new Error(

            "PIXAZO_API_KEY غير موجود"

        );

    }

    if (!model) {

        throw new Error(

            "اختر نموذج Pixazo"

        );

    }

    const endpoint =

        pixazoModelToEndpoint(

            model

        );

    const body = {

        prompt,

        num_images:

            Math.min(

                Math.max(

                    Number(n) || 1,

                    1

                ),

                4

            )

    };

    /*

       Parameters used by current Pixazo

       model families. Models that don't

       use a field simply ignore/fail it,

       so we keep the core prompt universal.

    */

    if (aspect) {

        body.aspect_ratio =

            aspect;

    }

    if (resolution) {

        body.resolution =

            resolution;

    }

    if (

        quality &&

        quality !== "auto"

    ) {

        body.quality =

            quality;

    }

    if (

        endpoint.includes(

            "gpt-image"

        )

    ) {

        body.size =

            aspectToSize(

                aspect

            );

        body.quality =

            quality === "auto"

                ? "high"

                : quality;

        body.format =

            "png";

    }

    const response =

        await axios.post(

            `https://gateway.pixazo.ai/${endpoint}`,

            body,

            {

                headers: {

                    "Content-Type":

                        "application/json",

                    "Cache-Control":

                        "no-cache",

                    "Ocp-Apim-Subscription-Key":

                        PIXAZO_API_KEY

                },

                timeout: 120000

            }

        );

    const data =

        response.data;

    if (

        data?.output?.media_url

    ) {

        return [

            {

                url:

                    data.output.media_url

            }

        ];

    }

    if (

        data?.url

    ) {

        return [

            {

                url:

                    data.url

            }

        ];

    }

    if (

        data?.polling_url

    ) {

        return pollPixazo(

            data.polling_url

        );

    }

    if (

        data?.request_id

    ) {

        return pollPixazo(

            `https://gateway.pixazo.ai/v2/requests/status/${encodeURIComponent(

                data.request_id

            )}`

        );

    }

    throw new Error(

        "Pixazo لم يرجع رابط الصورة أو polling URL"

    );

}

/* =========================

   ELEVENLABS IMAGE

========================= */

async function elevenLabsImage(

    prompt,

    model

) {

    if (!ELEVENLABS_API_KEY) {

        throw new Error(

            "ELEVENLABS_API_KEY غير موجود"

        );

    }

    if (!model) {

        throw new Error(

            "اختر نموذج ElevenLabs"

        );

    }

    const response =

        await axios.post(

            "https://api.elevenlabs.io/v1/flows/image",

            {

                model_id:

                    model,

                prompt

            },

            {

                headers: {

                    "xi-api-key":

                        ELEVENLABS_API_KEY,

                    "Content-Type":

                        "application/json"

                },

                timeout: 120000

            }

        );

    const job =

        response.data;

    if (

        job?.status === "completed" &&

        (

            job?.output?.url ||

            job?.url

        )

    ) {

        return [

            {

                url:

                    job.output?.url ||

                    job.url

            }

        ];

    }

    if (!job?.id) {

        throw new Error(

            "ElevenLabs لم يرجع Job ID"

        );

    }

    for (

        let i = 0;

        i < 90;

        i++

    ) {

        await new Promise(

            resolve =>

                setTimeout(

                    resolve,

                    3000

                )

        );

        const result =

            await axios.get(

                `https://api.elevenlabs.io/v1/flows/image/${encodeURIComponent(

                    job.id

                )}`,

                {

                    headers: {

                        "xi-api-key":

                            ELEVENLABS_API_KEY

                    },

                    timeout: 60000

                }

            );

        const data =

            result.data;

        if (

            data?.status === "completed"

        ) {

            const url =

                data?.output?.url ||

                data?.url ||

                data?.output?.media_url;

            if (url) {

                return [

                    {

                        url

                    }

                ];

            }

        }

        if (

            data?.status === "failed"

        ) {

            throw new Error(

                data?.error ||

                "ElevenLabs image generation failed"

            );

        }

    }

    throw new Error(

        "انتهت مهلة ElevenLabs"

    );

}

/* =========================

   IMAGE ROUTE

========================= */

app.post(

    "/api/image",

    async (req,res) => {

        try {

            const {

                provider,

                model,

                prompt,

                aspect_ratio,

                resolution,

                quality,

                n

            } = req.body;

            if (

                !prompt ||

                typeof prompt !== "string"

            ) {

                return res.status(400).json({

                    error:

                        "وصف الصورة مطلوب"

                });

            }

            let images;

            if (

                provider ===

                "openai"

            ) {

                images =

                    await openAIImage(

                        prompt,

                        model,

                        aspectToSize(

                            aspect_ratio

                        ),

                        quality,

                        n

                    );

            } else if (

                provider ===

                "openrouter"

            ) {

                images =

                    await openRouterImage(

                        prompt,

                        model,

                        aspect_ratio,

                        resolution,

                        quality,

                        n

                    );

            } else if (

                provider ===

                "gemini"

            ) {

                images =

                    await geminiImage(

                        prompt,

                        model,

                        aspect_ratio,

                        resolution

                    );

            } else if (

                provider ===

                "elevenlabs"

            ) {

                images =

                    await elevenLabsImage(

                        prompt,

                        model

                    );

            } else {

                images =

                    await pixazoImage(

                        prompt,

                        model,

                        aspect_ratio,

                        resolution,

                        quality,

                        n

                    );

            }

            if (

                !images ||

                !images.length

            ) {

                throw new Error(

                    "لم يتم إنشاء الصورة"

                );

            }

            res.json({

                images

            });

        } catch (error) {

            console.error(

                "IMAGE ERROR",

                error?.response?.data ||

                error.message

            );

            res.status(

                error?.response?.status || 500

            ).json({

                error:

                    apiError(error)

            });

        }

    }

);

/* =========================

   ELEVENLABS TTS

========================= */

app.post(

    "/api/voice",

    async (req,res) => {

        try {

            if (!ELEVENLABS_API_KEY) {

                return res.status(400).json({

                    error:

                        "ELEVENLABS_API_KEY غير موجود"

                });

            }

            const {

                text,

                voiceId

            } = req.body;

            if (!text) {

                return res.status(400).json({

                    error:

                        "النص مطلوب"

                });

            }

            const response =

                await axios.post(

                    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(

                        voiceId ||

                        ELEVENLABS_VOICE_ID

                    )}`,

                    {

                        text,

                        model_id:

                            "eleven_multilingual_v2"

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

                        timeout: 180000

                    }

                );

            res.setHeader(

                "Content-Type",

                "audio/mpeg"

            );

            res.send(

                Buffer.from(

                    response.data

                )

            );

        } catch (error) {

            console.error(

                "VOICE ERROR",

                error?.response?.data ||

                error.message

            );

            res.status(

                error?.response?.status || 500

            ).json({

                error:

                    apiError(error)

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

    async (req,res) => {

        let filePath;

        try {

            if (!req.file) {

                return res.status(400).json({

                    error:

                        "لم يتم رفع ملف"

                });

            }

            filePath =

                req.file.path;

            const ext =

                path.extname(

                    req.file.originalname

                ).toLowerCase();

            const allowed = [

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

                !allowed.includes(ext)

            ) {

                return res.status(400).json({

                    error:

                        "نوع الملف غير مدعوم"

                });

            }

            const content =

                fs.readFileSync(

                    filePath,

                    "utf8"

                );

            const prompt =

                `حلل الملف التالي باحترافية.

اسم الملف:

${req.file.originalname}

المحتوى:

${content.slice(

    0,

    150000

)}

`;

            let answer;

            if (OPENAI_API_KEY) {

                answer =

                    await openAIChat(

                        prompt,

                        []

                    );

            } else if (

                GEMINI_API_KEY

            ) {

                answer =

                    await geminiChat(

                        prompt,

                        []

                    );

            } else if (

                OPENROUTER_API_KEY

            ) {

                answer =

                    await openRouterChat(

                        prompt,

                        []

                    );

            } else {

                throw new Error(

                    "لا توجد خدمة محادثة لتحليل الملف"

                );

            }

            res.json({

                answer

            });

        } catch (error) {

            console.error(

                "FILE ERROR",

                error?.response?.data ||

                error.message

            );

            res.status(

                error?.response?.status || 500

            ).json({

                error:

                    apiError(error)

            });

        } finally {

            if (

                filePath &&

                fs.existsSync(filePath)

            ) {

                try {

                    fs.unlinkSync(

                        filePath

                    );

                } catch {}

            }

        }

    }

);

/* 404 */

app.use(

    (req,res) => {

        res.status(404).json({

            error:

                "المسار غير موجود",

            path:

                req.originalUrl

        });

    }

);

/* START */

app.listen(

    PORT,

    () => {

        console.log(

            `ALWAFER AI running on port ${PORT}`

        );

    }

);
