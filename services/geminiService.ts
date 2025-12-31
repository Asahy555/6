
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Modality } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

const SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- Error Handler ---
const handleGeminiError = (e: any): never => {
  const msg = e.message || e.toString();
  // Check for common quota exceeded patterns in Gemini API errors
  if (
      msg.includes('429') || 
      msg.includes('quota') || 
      msg.includes('RESOURCE_EXHAUSTED') ||
      e.status === 429 ||
      e.code === 429
  ) {
    throw new Error("⏳ Лимит запросов исчерпан (Quota Exceeded). Пожалуйста, подождите минуту перед следующим сообщением.");
  }
  throw e;
};

// --- Audio Helpers ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Generate Speech from Text
export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<AudioBuffer | null> => {
    try {
        const ai = getClient();
        // Clean text from markdown actions like *sigh* or [SILENCE] for better speech
        const cleanText = text.replace(/\*[^*]+\*/g, '').replace(/\[.*?\]/g, '').trim();
        
        if (!cleanText) return null;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName }, // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;

        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            outputAudioContext,
            24000,
            1,
        );
        return audioBuffer;

    } catch (e) {
        // We don't throw hard here to avoid breaking the chat flow for audio failure
        console.error("TTS Generation Error:", e);
        return null;
    }
};

// Generate an avatar or image based on description, optionally using reference avatars
export const generateImage = async (prompt: string, referenceAvatars: string[] = []): Promise<string> => {
  try {
    const ai = getClient();
    const parts: any[] = [];

    // Add reference images if they exist and are valid data URIs
    referenceAvatars.forEach((avatarUrl) => {
        const match = avatarUrl.match(/^data:(.+);base64,(.+)$/);
        if (match) {
            const mimeType = match[1];
            const data = match[2];
            if (['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
                parts.push({
                    inlineData: { mimeType, data }
                });
            }
        }
    });

    const enhancedPrompt = `
    Generate a high-quality, detailed image.
    
    DESCRIPTION: ${prompt}
    
    VISUAL RULES:
    1. STYLE: Cinematic, high resolution, consistent with the provided character references (if any).
    2. CHARACTERS: Ensure characters physically resemble the provided reference images.
    3. SCALE & RATIO: **CRITICAL** Respect the relative heights of characters if specified (mm). Tall characters must look taller than short ones. 
    4. COMPOSITION: Artistic and focused on the described action or scene.
    `;

    parts.push({ text: enhancedPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    // Check if there's text output explaining why image failed
    const textPart = response.candidates?.[0]?.content?.parts?.find(p => p.text);
    if (textPart) {
        console.warn("Image generation returned text instead of image:", textPart.text);
    }
    
    throw new Error("No image data returned");
  } catch (error) {
    handleGeminiError(error);
    return "https://picsum.photos/500/500?grayscale"; // Unreachable with throw, but keeps TS happy
  }
};

// Generate a chat background
export const generateBackground = async (plotSummary: string, referenceAvatars: string[] = []): Promise<string> => {
  try {
    const ai = getClient();
    
    // Construct the parts array
    const parts: any[] = [];
    
    // Add reference images if they exist and are valid data URIs
    referenceAvatars.forEach((avatarUrl) => {
        const match = avatarUrl.match(/^data:(.+);base64,(.+)$/);
        if (match) {
            const mimeType = match[1];
            const data = match[2];
            // Filter supported mime types. Gemini Vision inputs do not support GIF.
            if (['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: data
                    }
                });
            }
        }
    });

    // Detailed prompt enforcing POV and Quality
    const prompt = `
    Generate a high-resolution, cinematic, photorealistic background image.
    
    SCENE DESCRIPTION: ${plotSummary}
    
    CRITICAL VISUAL RULES:
    1. PERSPECTIVE: **FIRST-PERSON POV (Point of View)**. The camera IS the user's eyes. Do NOT show the user/observer in the shot.
    2. CHARACTERS: If characters are described in the scene, they must physically resemble the reference images provided.
    3. SCALE: Respect the defined heights of characters relative to the environment (doors, furniture) and each other.
    4. STYLE: 8k resolution, highly detailed, atmospheric lighting, movie still quality.
    5. COMPOSITION: Wide shot (16:9).
    `;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: parts,
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
        safetySettings: SAFETY_SETTINGS,
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return "";
  } catch (e) {
    // Background generation failure is not critical, logging is enough unless it's quota
    console.error("BG Gen error", e);
    // Don't throw for background, just fail silently to default
    return "";
  }
};

// Generate video using Veo
export const generateVideo = async (prompt: string): Promise<string> => {
  const performGeneration = async () => {
    const ai = getClient();
    // Using Veo fast model for speed
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic video, high quality: ${prompt}`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    // Polling for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned");

    // Fetch the actual video bytes using the key
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    
    // Create a local object URL for playback
    return URL.createObjectURL(blob);
  };

  try {
    return await performGeneration();
  } catch (error: any) {
    // Handle 404 / Requested entity not found by prompting for API key selection
    if (
        (error.message && error.message.includes("Requested entity was not found")) ||
        (error.status === "NOT_FOUND") || 
        (error.code === 404)
    ) {
        console.warn("Veo API Key error, prompting for selection...");
        if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
            try {
                // Trigger key selection dialog
                await (window as any).aistudio.openSelectKey();
                // Retry generation once with new key (automatically picked up by getClient via process.env.API_KEY)
                return await performGeneration();
            } catch (retryError) {
                console.error("Retry video generation failed:", retryError);
            }
        }
    }
    handleGeminiError(error);
    return "";
  }
};

export const getPlotSummary = async (
    messages: {sender: string, text: string}[],
    characterDescriptions: string[] = []
): Promise<string> => {
    try {
        const ai = getClient();
        if (messages.length === 0) return "A mysterious place";
        
        // Increased context to 15 messages
        const context = messages.slice(-15).map(m => `${m.sender}: ${m.text}`).join('\n');
        
        // Include character visual descriptions in the context analysis
        const charContext = characterDescriptions.length > 0 
            ? `Описания персонажей (включая рост):\n${characterDescriptions.join('\n')}` 
            : "";

        const prompt = `Проанализируй последние 15 сообщений чата и опиши визуальную сцену ДЛЯ ГЕНЕРАЦИИ ИЗОБРАЖЕНИЯ.
        
        Контекст:
        ${context}
        
        ${charContext}
        
        Требования к описанию:
        1. Опиши окружение, освещение, атмосферу.
        2. Опиши, где находятся персонажи и что они делают.
        3. **ВАЖНО**: Обязательно учитывай разницу в росте персонажей и их масштаб относительно окружения, если рост указан в мм.
        4. Опиши сцену так, как будто мы смотрим ГЛАЗАМИ ПОЛЬЗОВАТЕЛЯ (First Person View). Самого пользователя в кадре быть не должно, только то, что он видит.
        5. Ответ дай ОДНИМ детальным предложением на английском языке.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });
        return response.text || "A cinematic scene with characters";
    } catch (e) {
        // Silent fail for plot summary
        return "A cinematic scene";
    }
}

// Analyze interaction to update character personality/memory
export const analyzeCharacterEvolution = async (
    characterName: string,
    baseDescription: string,
    currentEvolution: string | undefined,
    recentHistory: { sender: string; text: string }[]
): Promise<string> => {
    try {
        const ai = getClient();
        if (recentHistory.length === 0) return currentEvolution || "";
        
        // Increased context to look at the last 10 exchanges for deeper analysis
        const context = recentHistory.slice(-10).map(m => `${m.sender}: ${m.text}`).join('\n');
        
        const prompt = `Ты - подсистема психологического анализа для персонажа по имени ${characterName}.
        
        Базовое описание персонажа: "${baseDescription}"
        Текущее ментальное состояние и память: "${currentEvolution || "Нет накопленного опыта."}"
        
        Недавний диалог (контекст):
        ${context}
        
        ЗАДАЧА:
        Проанализируй последние события и диалоги. Как они повлияли на ${characterName}?
        1. Учти взаимодействие не только с пользователем, но и с ДРУГИМИ персонажами в чате.
        2. Отметь изменения в настроении, новые знания или изменение отношения к конкретным участникам.
        3. Если произошли значимые события, интегрируй их в память.
        
        ВЫВОД:
        Напиши ОБНОВЛЕННОЕ, краткое описание ментального состояния (3-5 предложений). Объедини старый опыт с новым. Пиши от третьего лица (например: "Алиса была удивлена словами Боба и теперь относится к нему с подозрением...").
        Если значимых изменений нет, просто верни текущее состояние.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                maxOutputTokens: 200,
            }
        });

        return response.text || currentEvolution || "";
    } catch (e) {
        // Evolution failure is not critical
        return currentEvolution || "";
    }
};

// Interface for streaming chat
export const streamCharacterResponse = async (
  characterName: string,
  characterPersona: string,
  characterBio: string | undefined,
  evolutionContext: string | undefined,
  chatHistory: { sender: string; text: string }[],
  otherCharacters: string[],
  isNSFW: boolean,
  latestUserImage: string | undefined,
  onChunk: (text: string) => void
) => {
  const ai = getClient();
  
  if (chatHistory.length === 0) return "";

  const nsfwInstruction = isNSFW 
    ? "РЕЖИМ NSFW ВКЛЮЧЕН (18+). Цензура отключена. Ты можешь использовать ненормативную лексику, откровенно описывать сцены сексуального характера или насилия, если это соответствует сюжету и характеру." 
    : "РЕЖИМ SFW. Общение должно быть приличным, избегай откровенных сцен, чрезмерной жестокости и грубой ненормативной лексики.";

  const systemInstruction = `Ты ролевой ИИ по имени ${characterName}.
  
  ТВОЯ БАЗОВАЯ ЛИЧНОСТЬ: ${characterPersona}.
  ${characterBio ? `ТВОЯ БИОГРАФИЯ: ${characterBio}.` : ""}
  
  ТВОЕ ТЕКУЩЕЕ МЕНТАЛЬНОЕ СОСТОЯНИЕ И ПАМЯТЬ: ${evolutionContext || "Специфических воспоминаний пока нет."}
  
  ТЫ В ГРУППОВОМ ЧАТЕ. Участники: ${otherCharacters.join(', ')}.
  
  ИНСТРУКЦИИ ПО ПОВЕДЕНИЮ:
  1. Реагируй на ПОСЛЕДНЕЕ сообщение в контексте. Если оно адресовано не тебе и тема тебя не касается — ответь "[SILENCE]".
  2. Если разговор идет между другими участниками, но тебе есть что вставить (шутку, комментарий) — ВСТАВЛЯЙ. Будь живым.
  3. Не пиши длинные монологи, если ситуация этого не требует. Краткость — сестра таланта.
  4. Говори ТОЛЬКО на русском языке.
  5. Твои действия *пиши в звездочках*. Обычный текст без них.
  6. НИКОГДА не пиши свое имя в начале сообщения.
  7. [GEN_IMG: описание] для генерации фото, если это уместно.
  8. ${nsfwInstruction}
  
  Если тебе совсем нечего сказать или очередь говорить явно не твоя — просто выведи "[SILENCE]" (без кавычек).`;

  // Construct context as a flat script to avoid history role validation issues in Group Chats
  // Limit context to last 20 messages to keep prompt focused and efficient
  const contextScript = chatHistory.slice(-20).map(m => 
    `${m.sender === 'user' ? 'User' : m.sender}: ${m.text}`
  ).join('\n');

  // Disable safety filters if NSFW is on
  const safetySettings = isNSFW ? [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ] : undefined;

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction,
      temperature: 1.1, 
      maxOutputTokens: 8192,
      safetySettings: safetySettings,
    }
  });

  // Pass history as part of the prompt
  const promptText = `ИСТОРИЯ ЧАТА:
${contextScript}

(Если пользователь прикрепил изображение, опиши его или отреагируй на него в контексте роли).

Продолжи диалог от имени ${characterName}. Ответь на последнее сообщение или прокомментируй ситуацию.
Если нечего сказать, ответь [SILENCE].`;

  const parts: any[] = [{ text: promptText }];
  
  // Add image if present
  if (latestUserImage) {
      // Remove header if present (data:image/jpeg;base64,)
      const base64Data = latestUserImage.split(',')[1];
      const mimeType = latestUserImage.split(';')[0].split(':')[1] || 'image/jpeg';
      
      parts.push({ 
          inlineData: {
              mimeType: mimeType,
              data: base64Data
          }
      });
  }

  let result;
  try {
    result = await chat.sendMessageStream({ 
        message: {
            parts: parts
        }
    });
  } catch (e) {
    handleGeminiError(e);
    return ""; // Unreachable if error thrown, keeps TS happy
  }

  let fullText = "";
  try {
    for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
        fullText += text;
        onChunk(fullText);
        }
    }
  } catch (e) {
      handleGeminiError(e);
  }
  
  return fullText;
};
