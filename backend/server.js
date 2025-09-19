// server.js (또는 기존 Express 진입점 파일에 추가)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 대화 라우트: 클라이언트가 누적 messages를 보내면, assistant 답변을 돌려줍니다.
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages 배열이 필요합니다." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      stream: false,
      messages,
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    return res.json({ content });
  } catch (err) {
    console.error("OpenAI 호출 실패:", err);
    return res.status(500).json({ error: "OpenAI 호출 실패" });
  }
});

// 포트 실행 (이미 실행 중이면 생략)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
