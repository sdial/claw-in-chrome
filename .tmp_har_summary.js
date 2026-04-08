const fs = require("fs");
const har = JSON.parse(fs.readFileSync("C:/Users/26698/Desktop/ProxyPin_2026-04-08.har", "utf8"));
const entries = har.log?.entries || [];
function bodyText(postData) { return typeof postData?.text === "string" ? postData.text : ""; }
function respText(content) { if (typeof content?.text !== "string") return ""; return content.encoding === "base64" ? Buffer.from(content.text, "base64").toString("utf8") : content.text; }
const rows = [];
for (const [idx, e] of entries.entries()) {
  const url = e.request?.url || "";
  if (!/\/chat\/completions/i.test(url)) continue;
  const reqText = bodyText(e.request.postData);
  let req = {};
  try { req = JSON.parse(reqText || "{}"); } catch {}
  const resText = respText(e.response?.content);
  let res = {};
  try { res = JSON.parse(resText || "{}"); } catch {}
  rows.push({
    idx,
    ts: e.startedDateTime,
    method: e.request?.method,
    status: e.response?.status,
    contentType: e.response?.content?.mimeType || "",
    model: req.model,
    stream: req.stream,
    messages: Array.isArray(req.messages) ? req.messages.length : null,
    max_tokens: req.max_tokens ?? req.max_completion_tokens ?? null,
    promptPreview: Array.isArray(req.messages) && req.messages[0] ? String(req.messages[0].content || "").slice(0, 140) : "",
    responsePreview: typeof res?.choices?.[0]?.message?.content === "string" ? res.choices[0].message.content.slice(0, 220) : resText.slice(0, 220)
  });
}
console.log(JSON.stringify(rows, null, 2));
