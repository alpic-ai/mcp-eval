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
      options: ["anthropic/claude"],
    }),
    url: Flags.url({
      char: "u",
      description: "URL of the MCP server",
      required: true,
    }),
    header: Flags.string({
      char: "h",
      description: "Custom headers to send with requests (format: 'Header: value')",
      multiple: true,
    }),
  };

  private static parseHeaders(headerStrings?: string[]): HeadersInit | undefined {
    if (!headerStrings || headerStrings.length === 0) {
      return undefined;
    }

    return Object.fromEntries(
      headerStrings.map((headerString) => {
        const colonIndex = headerString.indexOf(':');
        if (colonIndex === -1) {
          throw new Error(`Invalid header format: "${headerString}". Expected format: "Header: value"`);
        }

        const key = headerString.slice(0, colonIndex).trim();
        const value = headerString.slice(colonIndex + 1).trim();

        if (!key) {
          throw new Error(`Invalid header format: "${headerString}". Header name cannot be empty`);
        }

        return [key, value];
      })
    );
  }

  public async run(): Promise<void> {
    const {
      args: { testFile },
      flags: { assistant, url, header },
    } = await this.parse(Run);

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

    const headers = Run.parseHeaders(header);
    await this.connect({ url, headers });

    const { tools } = await this.client.listTools();
    this.log(
      `✅ Connected with ${this.client.getServerVersion()?.name}. ${
        tools.length
      } tools found.`
    );

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

    this.log(["", "---- DETAILS ----", ""].join("\n"));

    await Promise.all(
      formattedTestCases.map(
        async ({ name, input_conversation, expected_tool_call }) => {
          const testCaseAssertionResult = await this.runTest({
            name,
            inputConversation: input_conversation,
            expectedToolCall: {
              toolName: expected_tool_call.tool_name,
              parameters: expected_tool_call.parameters,
            },
            tools,
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

  private async connect({ url, headers }: { url: URL; headers?: HeadersInit }) {
    const transportOptions = headers ? { requestInit: { headers } } : undefined;

    try {
      this.log("🔍 Connecting to the MCP server over StreamableHTTP...");
      const streamableTransport = new StreamableHTTPClientTransport(url, transportOptions);
      await this.client.connect(streamableTransport);
    } catch (streamableError) {
      this.log(
        `❌ Connection failed over StreamableHTTP: ${streamableError}\n🔍 Fallback - Connecting to the MCP server over SSE...`
      );

      try {
        const sseTransport = new SSEClientTransport(url, transportOptions);
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
          properties: tool.inputSchema["properties"],
          required: tool.inputSchema["required"],
        },
      },
    };
  }

  private async runTest({
    name,
    inputConversation,
    expectedToolCall,
    tools,
  }: {
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
      model: "anthropic/claude-3.7-sonnet",
      tools: tools.map(Run.formatToolToMessage),
      messages: [
        {
          role: "system",
          content: await readFile(
            resolve(
              dirname(fileURLToPath(import.meta.url)),
              "../prompts",
              "claude-3.7.md"
            ),
            "utf8"
          ),
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
