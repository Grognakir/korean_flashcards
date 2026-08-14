const SYSTEM_PROMPT = "Ты помощник, который составляет карточки корейских слов для учебного приложения. " +
  "На вход получаешь слово (на корейском или по-русски) и категорию словаря, в которую оно должно попасть. " +
  "Ответь СТРОГО валидным JSON-объектом, без markdown-разметки, без ```json, без пояснений до или после — " +
  "только сам объект. Формат:\n" +
  '{"kr": "слово на корейском (словарная форма)", "translit": "латиницей, упрощённая транслитерация", ' +
  '"meaning": "перевод на русский, кратко", "notes": "короткая заметка по употреблению или пустая строка", ' +
  '"examples": [{"kr": "пример-предложение на корейском", "ru": "перевод примера", "form": "форма слова в примере"}]}\n' +
  "В examples — минимум один пример, реалистичное простое предложение уровня TOPIK I.";

function buildUserPrompt(input, category) {
  return "Категория словаря: " + category + "\nСлово или значение: " + input;
}

async function callGemini(systemPrompt, userPrompt) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }] }),
  });
  if (!res.ok) throw new Error("gemini HTTP " + res.status);
  const json = await res.json();
  return json.candidates[0].content.parts[0].text;
}

async function callGroq(systemPrompt, userPrompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.GROQ_API_KEY },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) throw new Error("groq HTTP " + res.status);
  const json = await res.json();
  return json.choices[0].message.content;
}

async function callOpenRouter(systemPrompt, userPrompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + process.env.OPENROUTER_API_KEY },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error("openrouter HTTP " + res.status);
  const json = await res.json();
  return json.choices[0].message.content;
}

const PROVIDERS = [callGemini, callGroq, callOpenRouter];

function parseWordJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no JSON found in response");
  const obj = JSON.parse(match[0]);
  if (!obj.kr || !obj.translit || !obj.meaning) throw new Error("missing required fields");
  if (!Array.isArray(obj.examples) || obj.examples.length === 0) throw new Error("missing examples");
  for (const ex of obj.examples) {
    if (!ex.kr || !ex.ru) throw new Error("bad example");
  }
  return obj;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://grognakir.github.io");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-App-Secret");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (req.headers["x-app-secret"] !== process.env.APP_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { input, category } = req.body || {};
  if (!input || !category) return res.status(400).json({ error: "input и category обязательны" });

  const userPrompt = buildUserPrompt(input, category);
  let lastError = null;
  for (const call of PROVIDERS) {
    try {
      const text = await call(SYSTEM_PROMPT, userPrompt);
      const word = parseWordJSON(text);
      return res.status(200).json(word);
    } catch (e) {
      lastError = e;
      console.warn("provider failed:", e.message);
    }
  }
  return res.status(502).json({ error: "Все провайдеры недоступны: " + (lastError && lastError.message) });
};
