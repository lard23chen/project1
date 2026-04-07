const fs = require('fs');
const path = require('path');

function loadKnowledge(dataDir) {
  console.log(`[rag] dataDir=${dataDir}`);
  let files;
  try {
    files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  } catch (e) {
    console.error(`[rag] readdirSync failed: ${e.message}`);
    return [];
  }
  console.log(`[rag] files=${JSON.stringify(files)}`);
  const items = [];
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf-8'));
      items.push(...content);
    } catch (e) {
      console.error(`[rag] failed to load ${file}: ${e.message}`);
    }
  }
  console.log(`[rag] total items=${items.length}`);
  return items;
}

function tokenize(text) {
  // 中文字每個字視為一個 token，英文以空白分詞
  return text
    .toLowerCase()
    .split('')
    .filter(c => /[\u4e00-\u9fff\w]/.test(c));
}

function score(item, queryTokens) {
  const searchable = [
    ...item.tags,
    ...item.question.split('')
  ].map(t => t.toLowerCase());

  let hits = 0;
  for (const token of queryTokens) {
    if (searchable.some(s => s.includes(token) || token.includes(s))) {
      hits++;
    }
  }
  return hits;
}

function search(knowledge, query, topN = 5) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = knowledge
    .map(item => ({ item, score: score(item, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ item }) => item);

  return scored;
}

module.exports = { loadKnowledge, search };
