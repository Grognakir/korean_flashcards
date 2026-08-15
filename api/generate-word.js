const fs = require("fs");
const path = require("path");

var CATEGORIES = [];
try {
  var wordsRaw = fs.readFileSync(path.join(process.cwd(), "data/words.json"), "utf-8");
  CATEGORIES = JSON.parse(wordsRaw).map(function (c) { return c.category; });
} catch (e) {
  console.warn("could not read data/words.json for category list:", e.message);
}

function buildSystemPrompt() {
  return "Ты помощник, который составляет карточки корейских слов для учебного приложения. " +
    "На вход получаешь слово (на корейском или по-русски). Вот существующие категории словаря:\n" +
    CATEGORIES.map(function (c) { return "- " + c; }).join("\n") + "\n\n" +
    "Сначала попробуй отнести слово к ОДНОЙ из категорий выше — название должно совпадать ДОСЛОВНО. " +
    "Если слово по смыслу подходит к нескольким категориям, выбери одну — ту, к которой оно подходит БОЛЬШЕ ВСЕГО, " +
    "не перечисляй несколько.\n" +
    "Если ни одна существующая категория не подходит, придумай новую — короткое название в том же стиле, что и " +
    "существующие (например по части речи: «Глаголы», «Прилагательные», «Наречия», либо по смысловой области: " +
    "«Места», «Профессии»); в этом случае верни \"newCategory\": true. Если используешь существующую категорию — " +
    "\"newCategory\": false.\n\n" +
    "Ответь СТРОГО валидным JSON-объектом, без markdown-разметки, без ```json, без пояснений до или после — " +
    "только сам объект. Формат:\n" +
    '{"category": "название категории — существующее дословно, либо новое при newCategory: true", ' +
    '"newCategory": true или false, ' +
    '"kr": "слово на корейском (словарная форма)", ' +
    '"translit": "латиницей, упрощённая транслитерация", "meaning": "перевод на русский, кратко", ' +
    '"notes": "короткая заметка по употреблению или пустая строка", ' +
    '"examples": [{"kr": "пример-предложение на корейском", "ru": "перевод примера", "form": "форма слова в примере"}]}\n' +
    "В examples — минимум один пример, реалистичное простое предложение уровня TOPIK I.";
}

function buildUserPrompt(input) {
  return "Слово или значение: " + input;
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
  if (!obj.category || typeof obj.category !== "string" || !obj.category.trim()) throw new Error("missing category");
  const existingCategory = CATEGORIES.filter(function (c) {
    return c.trim().toLowerCase() === obj.category.trim().toLowerCase();
  })[0];
  if (existingCategory) {
    obj.category = existingCategory;
    obj.newCategory = false;
  } else {
    if (!obj.newCategory) throw new Error("invalid category: " + obj.category);
    obj.category = obj.category.trim();
    obj.newCategory = true;
  }
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

  const { input } = req.body || {};
  if (!input) return res.status(400).json({ error: "input обязателен" });
  if (!CATEGORIES.length) return res.status(500).json({ error: "Список категорий не загружен на сервере" });

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input);
  let lastError = null;
  for (const call of PROVIDERS) {
    try {
      const text = await call(systemPrompt, userPrompt);
      const word = parseWordJSON(text);
      return res.status(200).json(word);
    } catch (e) {
      lastError = e;
      console.warn("provider failed:", e.message);
    }
  }
  return res.status(502).json({ error: "Все провайдеры недоступны: " + (lastError && lastError.message) });
};
