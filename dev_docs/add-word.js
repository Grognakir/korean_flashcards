const REPO_OWNER = "Grognakir";
const REPO_NAME = "korean_flashcards";
const FILE_PATH = "data/words.json";

async function githubRequest(method, body) {
  const url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + FILE_PATH;
  return fetch(url, {
    method: method,
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
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

  const { category, kr, translit, meaning, notes, examples, newCategory } = req.body || {};
  if (!category || !kr || !translit || !meaning || !Array.isArray(examples) || examples.length === 0) {
    return res.status(400).json({ error: "Не хватает обязательных полей" });
  }

  try {
    const getRes = await githubRequest("GET");
    if (!getRes.ok) throw new Error("GitHub GET " + getRes.status);
    const fileData = await getRes.json();
    const content = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf-8"));

    let group = content.find((c) => c.category === category);
    if (!group) {
      if (!newCategory) return res.status(400).json({ error: "Неизвестная категория: " + category });
      group = { category: category, words: [] };
      content.push(group);
    }

    group.words.push({
      kr: kr,
      translit: translit,
      meaning: meaning,
      notes: notes || "",
      related: null,
      examples: examples,
    });

    const newContent = Buffer.from(JSON.stringify(content), "utf-8").toString("base64");
    const putRes = await githubRequest("PUT", {
      message: "Add word: " + kr + " (via AI)",
      content: newContent,
      sha: fileData.sha,
      branch: "main",
    });
    if (!putRes.ok) {
      const errBody = await putRes.text();
      throw new Error("GitHub PUT " + putRes.status + ": " + errBody);
    }
    const putData = await putRes.json();
    return res.status(200).json({ ok: true, commitUrl: putData.commit && putData.commit.html_url });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: e.message });
  }
};
