const assert = require("node:assert/strict");

function extractFindReply(payload) {
  function extractReadableTextFromPart(part, allowReasoning = false) {
    if (typeof part === "string") {
      return part.trim();
    }
    if (!part || typeof part !== "object") {
      return "";
    }
    const type = String(part.type || "").trim().toLowerCase();
    if (type === "tool_use" || type === "tool_result") {
      return "";
    }
    if (type === "text" && typeof part.text === "string") {
      return part.text.trim();
    }
    if (allowReasoning && type === "thinking" && typeof part.thinking === "string") {
      return part.thinking.trim();
    }
    if (allowReasoning && type === "reasoning") {
      if (typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
      if (typeof part.reasoning === "string" && part.reasoning.trim()) {
        return part.reasoning.trim();
      }
    }
    const directCandidates = [part.output_text, part.content_text, part.response_text, part.text];
    if (allowReasoning) {
      directCandidates.push(part.reasoning, part.thinking);
    }
    for (const candidate of directCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    if (typeof part.content === "string" && part.content.trim()) {
      return part.content.trim();
    }
    for (const nested of [part.content, part.message?.content, part.output, part.reasoning_details, part.delta]) {
      const text = extractTextFromContentParts(nested, allowReasoning);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function extractTextFromContentParts(parts, allowReasoning = false) {
    if (typeof parts === "string") {
      return parts.trim();
    }
    if (parts && typeof parts === "object" && !Array.isArray(parts)) {
      return extractReadableTextFromPart(parts, allowReasoning);
    }
    if (!Array.isArray(parts)) {
      return "";
    }
    return parts.map((part) => extractReadableTextFromPart(part, allowReasoning)).filter(Boolean).join(" ").trim();
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const candidates = [
    extractTextFromContentParts(payload.content, false),
    extractTextFromContentParts(payload.message, false),
    extractTextFromContentParts(payload.message?.content, false),
    Array.isArray(payload.output) ? payload.output.map((item) => extractTextFromContentParts(item?.content, false)).filter(Boolean).join(" ").trim() : "",
    Array.isArray(payload.choices) ? payload.choices.map((choice) => typeof choice?.message?.content === "string" ? choice.message.content.trim() : extractTextFromContentParts(choice?.message, false) || extractTextFromContentParts(choice?.message?.content, false)).filter(Boolean).join(" ").trim() : "",
    typeof payload.message === "string" ? payload.message.trim() : "",
    typeof payload.content === "string" ? payload.content.trim() : "",
    typeof payload.response_text === "string" ? payload.response_text.trim() : "",
    typeof payload.content_text === "string" ? payload.content_text.trim() : ""
  ];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }
  return "";
}

function testAnthropicContentText() {
  const result = extractFindReply({
    content: [
      {
        type: "text",
        text: "FOUND: 1\nSHOWING: 1\n---\nref_1 | textbox | Search | textbox | anthropic text"
      }
    ]
  });
  assert.equal(result, "FOUND: 1\nSHOWING: 1\n---\nref_1 | textbox | Search | textbox | anthropic text");
}

function testOpenAIContentOutputTextPart() {
  const result = extractFindReply({
    choices: [
      {
        message: {
          content: [
            {
              type: "output_text",
              output_text: "FOUND: 1\nSHOWING: 1\n---\nref_2 | button | Search | button | output_text part"
            }
          ]
        }
      }
    ]
  });
  assert.equal(result, "FOUND: 1\nSHOWING: 1\n---\nref_2 | button | Search | button | output_text part");
}

function testNestedOutputContent() {
  const result = extractFindReply({
    output: [
      {
        content: [
          {
            type: "output_text",
            output_text: "FOUND: 1\nSHOWING: 1\n---\nref_3 | heading | Video title | heading | nested output"
          }
        ]
      }
    ]
  });
  assert.equal(result, "FOUND: 1\nSHOWING: 1\n---\nref_3 | heading | Video title | heading | nested output");
}

function testMessageLevelResponseText() {
  const result = extractFindReply({
    message: {
      content: [],
      response_text: "FOUND: 0\nERROR: no matches"
    }
  });
  assert.equal(result, "FOUND: 0\nERROR: no matches");
}

function main() {
  testAnthropicContentText();
  testOpenAIContentOutputTextPart();
  testNestedOutputContent();
  testMessageLevelResponseText();
  console.log("find response extraction regression tests passed");
}

main();
