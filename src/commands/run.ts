import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { Args, Command, Flags } from "@oclif/core";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAI } from "openai";
import {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
} from "openai/resources";
import { parse } from "yaml";
import z from "zod";
import _ from "lodash";
import { randomUUID } from "node:crypto";
import mustache from "mustache";

const ToolMessageSchema = z.object({
  role: z.literal("tool"),
  tool_name: z.string(),
  parameters: z.record(z.string(), z.unknown()),
  response: z.string(),
});

const ConversationMessageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  }),
  ToolMessageSchema,
]);

const TestCaseSchema = z
  .string()
  .transform((rawYmlContent) => parse(rawYmlContent))
  .pipe(
    z.object({
      test_cases: z
        .array(
          z
            .object({
              name: z.string(),
              expected_tool_call: z.object({
                tool_name: z.string(),
                parameters: z.record(z.string(), z.unknown()),
              }),
            })
            .and(
              z.union([
                z.object({ input_prompt: z.string() }),
                z.object({
                  input_conversation: z.array(ConversationMessageSchema).min(1),
                }),
              ])
            )
        )
        .min(1),
    })
  );

type TestCaseAssertionResult = {
  name: string;
} & (PassedResult | FailedResult | ErrorResult);

type PassedResult = { status: "passed" };

type ErrorResult = { status: "error"; errorMessage: string };

type FailedResult = { status: "failed" } & (
  | MessageMismatch
  | ToolMismatch
  | ParametersMismatch
);

type MessageMismatch = {
  type: "message";
  expected: "tool_call";
  actual: string;
};
type ToolMismatch = { type: "tool"; expected: string; actual: string };
type ParametersMismatch = {
  type: "parameters";
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
};

type Assistant = "anthropic/claude" | "openai/chatgpt";
const ASSISTANT_CONFIGS: Record<
  Assistant,
  { model: string; systemPromptFileName: string; additionalTools: string[] }
> = {
  "anthropic/claude": {
    model: "anthropic/claude-3.7-sonnet",
    systemPromptFileName: "claude-3.7.md",
    additionalTools: ["drive_search", "web_search"],
  },
  "openai/chatgpt": {
    model: "openai/gpt-5",
    systemPromptFileName: "gpt-5.md",
    additionalTools: [
      "bio",
      "automations",
      "canmore_create_textdoc",
      "canmore_update_textdoc",
      "canmore_comment_textdoc",
      "file_search",
      "image_gen",
      "python",
      "guardian_tool",
      "web",
    ],
  },
};

const expandToolMessage = (
  message: z.infer<typeof ToolMessageSchema>
): ChatCompletionMessageParam[] => {
  const toolCallId = randomUUID();

  return [
    {
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: toolCallId,
          type: "function",
          function: {
            name: message.tool_name,
            arguments: JSON.stringify(message.parameters),
          },
        },
      ],
    },
    {
      role: "tool",
      tool_call_id: toolCallId,
      content: message.response,
    },
  ];
};

export default class Run extends Command {
  private client = new Client({ name: "mcp-eval", version: "0.0.1" });
  private model = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  private testCaseAssertionResults: TestCaseAssertionResult[] = [];

  static override args = {
    testFile: Args.file({
      description: "YAML file path containing the test suite",
      parse: (file) => readFile(file, "utf8"),
      name: "testFilePath",
      required: true,
    }),
  };
  static override description =
    "Run the test suite described in the provided YAML file.";
  static override examples = ["<%= config.bin %> <%= command.id %>"];
  static override flags = {
    assistant: Flags.string({
      char: "a",
      default: "anthropic/claude",
      description:
        "Assistant configuration to use (impact model and system prompt)",
      options: Object.keys(ASSISTANT_CONFIGS),
    }),
    url: Flags.url({
      char: "u",
      description: "URL of the MCP server",
      required: true,
    }),
  };

  public async run(): Promise<void> {
    const {
      args: { testFile },
      flags: { assistant, url },
    } = await this.parse(Run);

    const assistantConfig =
      ASSISTANT_CONFIGS[assistant as keyof typeof ASSISTANT_CONFIGS];

    const testCaseFileParsingResult = TestCaseSchema.safeParse(testFile);
    if (!testCaseFileParsingResult.success) {
      this.error(
        [
          "Test case file format contains validation error(s):",
          z.prettifyError(testCaseFileParsingResult.error),
        ].join("\n")
      );
    }

    const testCases = testCaseFileParsingResult.data.test_cases;
    this.log(`📚 Found ${testCases.length} test case(s)`);

    await this.connect({ url });

    const { tools } = await this.client.listTools();
    this.log(
      `✅ Connected with ${this.client.getServerVersion()?.name}. ${
        tools.length
      } tools found.`
    );

    this.log(
      `🤖 Using ${assistant} assistant with model ${assistantConfig.model}`
    );

    if (assistantConfig.additionalTools.length > 0) {
      this.log(
        `🔧 Adding ${
          assistantConfig.additionalTools.length
        } assistant default tool(s): ${assistantConfig.additionalTools.join(
          ", "
        )}`
      );
    }

    let displayInputPromptDeprecationWarning = false;
    const formattedTestCases = testCases.map((testCase) => {
      if (!("input_prompt" in testCase)) {
        return testCase;
      }

      displayInputPromptDeprecationWarning = true;
      const { input_prompt, ...rest } = testCase;

      return {
        ...rest,
        input_conversation: [{ role: "user" as const, content: input_prompt }],
      };
    });

    if (displayInputPromptDeprecationWarning) {
      this.warn("⚠ input_prompt is deprecated, use input_conversation instead");
    }

    const allToolMessages = formattedTestCases
      .map(({ input_conversation }) => input_conversation)
      .flat()
      .filter((message) => message.role === "tool");
    const allAvailableToolNames = tools.map(({ name }) => name);

    allToolMessages.forEach((message) => {
      if (!allAvailableToolNames.includes(message.tool_name)) {
        this.error(
          `Tool referenced in a test case is not available in the MCP server. Referenced tool: ${
            message.tool_name
          }. Available tools: ${allAvailableToolNames.join(", ")}`
        );
      }
    });

    const systemPromptTemplate = await readFile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../prompts",
        assistantConfig.systemPromptFileName
      ),
      "utf8"
    );

    const systemPrompt = mustache.render(systemPromptTemplate, {
      userLocation: "San Francisco, CA, USA",
      currentDateTime: new Date().toISOString().slice(0, 10),
    });

    this.log(["", "---- DETAILS ----", ""].join("\n"));

    await Promise.all(
      formattedTestCases.map(
        async ({ name, input_conversation, expected_tool_call }) => {
          const testCaseAssertionResult = await this.runTest({
            model: assistantConfig.model,
            systemPrompt,
            name,
            inputConversation: input_conversation,
            expectedToolCall: {
              toolName: expected_tool_call.tool_name,
              parameters: expected_tool_call.parameters,
            },
            tools: [
              ...tools,
              ...assistantConfig.additionalTools.map((toolName) => ({
                name: toolName,
                description: toolName,
                inputSchema: {
                  type: "object" as const,
                },
              })),
            ],
          });

          this.log(
            [
              testCaseAssertionResult.status === "passed" ? "✓" : "×",
              name.length > 50 ? `${name.slice(0, 50)}...` : name,
            ].join(" ")
          );

          this.testCaseAssertionResults.push(testCaseAssertionResult);
        }
      )
    );

    await this.exportDetailedTestResults();
    this.printTestResults();
    this.client.close();
    this.exit(0);
  }

  private async connect({ url }: { url: URL }) {
    try {
      this.log("🔍 Connecting to the MCP server over StreamableHTTP...");
      const streamableTransport = new StreamableHTTPClientTransport(url);
      await this.client.connect(streamableTransport);
    } catch (streamableError) {
      this.log(
        `❌ Connection failed over StreamableHTTP: ${streamableError}\n🔍 Fallback - Connecting to the MCP server over SSE...`
      );

      try {
        const sseTransport = new SSEClientTransport(url);
        await this.client.connect(sseTransport);
      } catch (sseError) {
        this.error(
          `Failed to connect with either transport method:\n1. Streamable HTTP error: ${streamableError}\n2. SSE error: ${sseError}`
        );
      }
    }
  }

  private printTestResults() {
    const passedTests = this.testCaseAssertionResults.filter(
      ({ status }) => status === "passed"
    );

    this.log(
      [
        "",
        "---- RESULTS ----",
        "",
        `Overall MCP server accuracy: ${Math.round(
          (100 * passedTests.length) / this.testCaseAssertionResults.length
        )}%`,
        "",
        `✅ ${
          this.testCaseAssertionResults.filter(
            ({ status }) => status === "passed"
          ).length
        } test(s) passed`,
        `❌ ${
          this.testCaseAssertionResults.filter(
            (test) => test.status === "failed"
          ).length
        } test(s) failed, for the following reasons:`,
        `   => 💤 ${
          this.testCaseAssertionResults.filter(
            (test) => test.status === "failed" && test.type === "message"
          ).length
        } test(s) did not trigger any tool call`,
        `   => 🔀 ${
          this.testCaseAssertionResults.filter(
            (test) => test.status === "failed" && test.type === "tool"
          ).length
        } test(s) called the wrong tool`,
        `   => 📚 ${
          this.testCaseAssertionResults.filter(
            (test) => test.status === "failed" && test.type === "parameters"
          ).length
        } test(s) used the wrong set of parameters`,
      ].join("\n")
    );
  }

  private async exportDetailedTestResults() {
    await writeFile(
      "mcp-eval.json",
      new Uint8Array(Buffer.from(JSON.stringify(this.testCaseAssertionResults)))
    );
  }

  static formatToolToMessage(
    tool: ListToolsResult["tools"][number]
  ): Exclude<ChatCompletionCreateParams["tools"], undefined>[number] {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema["properties"] ?? {},
          required: tool.inputSchema["required"] ?? [],
        },
      },
    };
  }

  private async runTest({
    model,
    systemPrompt,
    name,
    inputConversation,
    expectedToolCall,
    tools,
  }: {
    model: string;
    systemPrompt: string;
    name: string;
    inputConversation: z.infer<typeof ConversationMessageSchema>[];
    expectedToolCall: {
      toolName: string;
      parameters: Record<string, unknown>;
    };
    tools: ListToolsResult["tools"];
  }): Promise<TestCaseAssertionResult> {
    const formattedMessages = inputConversation
      .map((message) =>
        message.role === "tool" ? expandToolMessage(message) : message
      )
      .flat();

    const response = await this.model.chat.completions.create({
      model,
      tools: tools.map(Run.formatToolToMessage),
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...formattedMessages,
      ],
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      return {
        name,
        status: "failed",
        type: "message",
        actual: response.choices[0].message.content!,
        expected: "tool_call",
      };
    }

    const actualToolName = toolCall.function.name;
    if (toolCall.function.name !== expectedToolCall.toolName) {
      return {
        name,
        status: "failed",
        type: "tool",
        actual: actualToolName,
        expected: expectedToolCall.toolName,
      };
    }

    const actualToolParameters = JSON.parse(toolCall.function.arguments);
    if (
      !Object.entries(expectedToolCall.parameters).every(([key, value]) =>
        _.isEqual(actualToolParameters[key], value)
      )
    ) {
      return {
        name,
        status: "failed",
        type: "parameters",
        actual: actualToolParameters,
        expected: expectedToolCall.parameters,
      };
    }

    return { name, status: "passed" };
  }
}
