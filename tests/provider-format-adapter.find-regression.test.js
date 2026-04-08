const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const adapterPath = path.join(__dirname, "..", "provider-format-adapter.js");
const adapterSource = fs.readFileSync(adapterPath, "utf8");

async function runAdapterWithUpstreamHandler(upstreamHandler) {
  const config = {
    format: "openai_chat",
    baseUrl: "https://provider.example/v1",
    apiKey: "test-key",
    defaultModel: "gpt-5.4",
    fastModel: ""
  };
  const upstreamCalls = [];
  const nativeFetch = async (input, init) => {
    upstreamCalls.push({
      url: String(input),
      body: init && typeof init.body === "string" ? JSON.parse(init.body) : null,
      headers: init ? Object.fromEntries(new Headers(init.headers).entries()) : {}
    });
    return upstreamHandler({
      input,
      init,
      call: upstreamCalls[upstreamCalls.length - 1],
      callIndex: upstreamCalls.length - 1
    });
  };
  const sandbox = {
    console,
    Request,
    Response,
    Headers,
    URL,
    TextEncoder,
    TextDecoder,
    TransformStream,
    ReadableStream,
    WritableStream,
    AbortController,
    DOMException,
    setTimeout,
    clearTimeout,
    fetch: nativeFetch,
    chrome: {
      storage: {
        local: {
          async get(key) {
            if (typeof key === "string") {
              return {
                [key]: config
              };
            }
            return {
              customProviderConfig: config
            };
          }
        },
        onChanged: {
          addListener() {}
        }
      }
    }
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(adapterSource, sandbox, {
    filename: "provider-format-adapter.js"
  });
  const request = new Request("https://provider.example/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": "anthropic-test-key",
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "gpt-5.4",
      max_tokens: 128,
      stream: false,
      messages: [
        {
          role: "user",
          content: "Find the search box."
        }
      ]
    })
  });
  const response = await sandbox.fetch(request);
  return {
    json: await response.json(),
    upstreamCalls
  };
}

async function runAdapterWithPayload(providerPayload) {
  return runAdapterWithUpstreamHandler(async () => new Response(JSON.stringify(providerPayload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  }));
}

async function testOutputTextPartsSurviveOpenAIChatTransform() {
  const payload = {
    id: "chatcmpl-output-text",
    model: "gpt-5.4",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: [
            {
              type: "output_text",
              output_text: "FOUND: 1\nSHOWING: 1\n---\nref_1 | textbox | Search | textbox | text match"
            }
          ]
        }
      }
    ]
  };
  const result = await runAdapterWithPayload(payload);
  assert.equal(result.upstreamCalls.length, 1, "should call upstream once");
  assert.equal(result.upstreamCalls[0].url, "https://provider.example/v1/chat/completions");
  assert.equal(result.json.type, "message");
  assert.deepEqual(result.json.content, [
    {
      type: "text",
      text: "FOUND: 1\nSHOWING: 1\n---\nref_1 | textbox | Search | textbox | text match"
    }
  ]);
}

async function testStringContentStillWorks() {
  const payload = {
    id: "chatcmpl-string",
    model: "gpt-5.4",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: "FOUND: 0\nERROR: no matches"
        }
      }
    ]
  };
  const result = await runAdapterWithPayload(payload);
  assert.deepEqual(result.json.content, [
    {
      type: "text",
      text: "FOUND: 0\nERROR: no matches"
    }
  ]);
}

async function testMessageLevelResponseTextFallbackWorks() {
  const payload = {
    id: "chatcmpl-response-text",
    model: "gpt-5.4",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: [],
          response_text: "FOUND: 1\nSHOWING: 1\n---\nref_2 | button | Search | button | response_text fallback"
        }
      }
    ]
  };
  const result = await runAdapterWithPayload(payload);
  assert.deepEqual(result.json.content, [
    {
      type: "text",
      text: "FOUND: 1\nSHOWING: 1\n---\nref_2 | button | Search | button | response_text fallback"
    }
  ]);
}

async function testEmptyNonStreamContentRetriesAsStream() {
  const result = await runAdapterWithUpstreamHandler(async ({ callIndex, call }) => {
    if (callIndex === 0) {
      return new Response(JSON.stringify({
        id: "chatcmpl-empty-content",
        model: "gpt-5.4",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant"
            }
          }
        ],
        usage: {
          prompt_tokens: 42,
          completion_tokens: 7,
          total_tokens: 49
        }
      }), {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "content-length": "280"
        }
      });
    }
    assert.equal(call.body.stream, true, "stream fallback should request streaming");
    assert.equal(call.headers.accept, "text/event-stream", "stream fallback should request SSE");
    return new Response([
      "data: {\"id\":\"chatcmpl-stream\",\"object\":\"chat.completion.chunk\",\"model\":\"gpt-5.4\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\"},\"finish_reason\":null}]}",
      "",
      "data: {\"id\":\"chatcmpl-stream\",\"object\":\"chat.completion.chunk\",\"model\":\"gpt-5.4\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"FOUND: 1\\nSHOWING: 1\\n---\\nref_9 | textbox | Search | textbox | streamed fallback\"},\"finish_reason\":null}]}",
      "",
      "data: {\"id\":\"chatcmpl-stream\",\"object\":\"chat.completion.chunk\",\"model\":\"gpt-5.4\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":42,\"completion_tokens\":7,\"total_tokens\":49}}",
      "",
      "data: [DONE]",
      ""
    ].join("\n"), {
      status: 200,
      headers: {
        "content-type": "text/event-stream"
      }
    });
  });
  assert.equal(result.upstreamCalls.length, 2, "should retry once with streaming fallback");
  assert.deepEqual(result.json.content, [
    {
      type: "text",
      text: "FOUND: 1\nSHOWING: 1\n---\nref_9 | textbox | Search | textbox | streamed fallback"
    }
  ]);
}

async function main() {
  await testOutputTextPartsSurviveOpenAIChatTransform();
  await testStringContentStillWorks();
  await testMessageLevelResponseTextFallbackWorks();
  await testEmptyNonStreamContentRetriesAsStream();
  console.log("provider-format-adapter find regression tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
