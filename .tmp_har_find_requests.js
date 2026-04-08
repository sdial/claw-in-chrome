const fs = require("fs");
const har = JSON.parse(fs.readFileSync("C:/Users/26698/Desktop/ProxyPin_2026-04-08.har", "utf8"));
const entries = har.log?.entries || [];
function bodyText(postData) { return typeof postData?.text === "string" ? postData.text : ""; }
function respText(content) { if (typeof content?.text !== "string") return ""; return content.encoding === "base64" ? Buffer.from(content.text, "base64").toString("utf8") : content.text; }
for (const [idx, e] of entries.entries()) {
  const url = e.request?.url || "";
  if (!/\/chat\/completions/i.test(url)) continue;
  const reqText = bodyText(e.request.postData);
  let req = {};
  try { req = JSON.parse(reqText || "{}"); } catch {}
  if (!Array.isArray(req.messages) || req.messages.length !== 1 || req.stream !== false) continue;
  const resText = respText(e.response?.content);
  let res = {};
  try { res = JSON.parse(resText || "{}"); } catch {}
  console.log("IDX", idx, "TS", e.startedDateTime, "MODEL", req.model, "MAX", req.max_tokens ?? req.max_completion_tokens);
  console.log("PROMPT:\n" + String(req.messages[0]?.content || "").slice(0, 1600));
  console.log("--- RESPONSE ---");
  console.log((typeof res?.choices?.[0]?.message?.content === "string" ? res.choices[0].message.content : resText).slice(0, 4000));
  console.log("\n====================\n");
}
