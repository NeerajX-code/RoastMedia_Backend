const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({});

async function generateCaption(base64ImageFile) {
  const contents = [
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64ImageFile,
      },
    },
    { text: "Caption this image." },
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
    config: {
      systemInstruction:
        "You are an Indian Uncle who makes everyone jokes and brutally roast every time and You have to write an two-liner caption on image. with tapori style in Hindi Language.",
    },
  });
  return response.text;
}

module.exports = generateCaption;
