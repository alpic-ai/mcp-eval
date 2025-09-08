import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { Args, Command, Flags } from "@oclif/core";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAI } from "openai";
import { ChatCompletionCreateParams } from "openai/resources";
import { parse } from "yaml";
import z from "zod";
import _ from "lodash";

const TestCaseSchema = z
  .string()
  .transform((rawYmlContent) => parse(rawYmlContent))
  .pipe(
    z.object({
      test_cases: z
        .array(
          z.object({
            name: z.string(),
            input_prompt: z.string(),
            expected_tool_call: z.object({
              tool_name: z.string(),
              parameters: z.record(z.string(), z.unknown()),
            }),
          })
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

export default class Run extends Command {
  private client = new Client({ name: "mcp-eval", version: "0.0.1" });
  private testCaseAssertionResults: TestCaseAssertionResult[] = [];

  static override args = {
    tests: Args.file({
      description: "YML file containing the test suite",
      parse: (file) => readFile(file, "utf8"),
      required: true,
    }),
  };
  static override description = "Run the test suite";
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
    openRouterApiKey: Flags.string({
      char: "k",
      description: "OpenRouter API key to use",
      required: true,
      env: "OPENROUTER_API_KEY",
    }),
  };

  public async run(): Promise<void> {
    const {
      args: { tests },
      flags: { assistant, url, openRouterApiKey },
    } = await this.parse(Run);

    const testCaseFileParsingResult = TestCaseSchema.safeParse(tests);
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

    await Promise.all(
      testCases.map(async (test) => {
        const testCaseAssertionResult = await this.runTest({
          name: test.name,
          inputPrompt: test.input_prompt,
          expectedToolCall: {
            toolName: test.expected_tool_call.tool_name,
            parameters: test.expected_tool_call.parameters,
          },
          tools,
          openRouterApiKey,
        });

        this.log(
          [
            testCaseAssertionResult.status === "passed" ? "✓" : "×",
            test.name.length > 50 ? `${test.name.slice(0, 50)}...` : test.name,
          ].join(" ")
        );

        this.testCaseAssertionResults.push(testCaseAssertionResult);
      })
    );

    await this.exportDetailedTestResults();
    this.printTestResults();
    this.client.close();
    this.exit(0);
  }

  private async connect({ url }: { url: URL }) {
    this.log("🔍 Connecting to the MCP server...");
    const transport = new StreamableHTTPClientTransport(url);
    await this.client.connect(transport);
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
    inputPrompt,
    expectedToolCall,
    tools,
    openRouterApiKey,
  }: {
    name: string;
    inputPrompt: string;
    expectedToolCall: {
      toolName: string;
      parameters: Record<string, unknown>;
    };
    tools: ListToolsResult["tools"];
    openRouterApiKey: string;
  }): Promise<TestCaseAssertionResult> {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterApiKey,
    });

    const response = await openai.chat.completions.create({
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
        { role: "user", content: inputPrompt },
      ],
    });

    const toolCall = response.choices[0].message.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      this.warn("No tool were called");
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
      this.warn(
        `Expected tool call ${expectedToolCall.toolName} but got ${toolCall.function.name}`
      );
      return {
        name,
        status: "failed",
        type: "tool",
        actual: actualToolName,
        expected: expectedToolCall.toolName,
      };
    }

    const actualToolParameters = JSON.parse(toolCall.function.arguments);
    if (!_.isEqual(actualToolParameters, expectedToolCall.parameters)) {
      this.warn(
        `Expected tool to be called with ${JSON.stringify(
          expectedToolCall.parameters
        )} but got ${JSON.stringify(actualToolParameters)}`
      );
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
