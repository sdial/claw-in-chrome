const fs = require('fs');
const txt = fs.readFileSync('tmp/minimax.txt', 'utf8');
const m = txt.match(/#\s*(sk-api-[A-Za-z0-9_\-]+)/);
if (!m) throw new Error('key not found');
const key = m[1];
const prompt = `You are helping find elements on a web page. The user wants to find: "搜索框"

Here is the accessibility tree of the page:
[ref_1] textbox "搜索框"
[ref_2] heading "Wikipedia"

Find ALL elements that match the user's query. Return up to 20 most relevant matches, ordered by relevance.

Return plain text only in this exact format (one line per matching element):

FOUND: <total_number_of_matching_elements>
SHOWING: <number_shown_up_to_20>
---
ref_X | role | name | type | reason why this matches
ref_Y | role | name | type | reason why this matches

If no matching elements are found, return only:
FOUND: 0
ERROR: explanation of why no elements were found`;

(async () => {
  for (const model of ['MiniMax-M2.7', 'M2-her']) {
    const res = await fetch('https://api.minimaxi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + key,
        'accept': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        stream: false,
        temperature: 0
      })
    });
    const text = await res.text();
    console.log('MODEL', model);
    console.log(text.slice(0, 2000));
    console.log('---');
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
