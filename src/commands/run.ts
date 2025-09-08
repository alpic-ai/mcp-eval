import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsResult } from "@modelcontextprotocol/sdk/types.js";
import { Args, Command, Flags } from "@oclif/core";
import { readFile } from "node:fs/promises";
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

export default class Run extends Command {
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

    this.log("🔍 Connecting to the MCP server...");
    const client = new Client({ name: "mcp-eval", version: "0.0.1" });
    const transport = new StreamableHTTPClientTransport(url);
    await client.connect(transport);

    const { tools } = await client.listTools();
    this.log(
      `✅ Connected with ${client.getServerVersion()?.name}. ${
        tools.length
      } tools found.`
    );

    const test = testCases[0];
    await this.runTest({
      inputPrompt: test.input_prompt,
      expectedToolCall: {
        toolName: test.expected_tool_call.tool_name,
        parameters: test.expected_tool_call.parameters,
      },
      tools,
      openRouterApiKey,
    });

    await transport.terminateSession();
    await client.close();
    this.exit(0);
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
    inputPrompt,
    expectedToolCall,
    tools,
    openRouterApiKey,
  }: {
    inputPrompt: string;
    expectedToolCall: {
      toolName: string;
      parameters: Record<string, unknown>;
    };
    tools: ListToolsResult["tools"];
    openRouterApiKey: string;
  }) {
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
      this.error("No tool were called");
    }

    if (toolCall.function.name !== expectedToolCall.toolName) {
      this.error(
        `Expected tool call ${expectedToolCall.toolName} but got ${toolCall.function.name}`
      );
    }

    const actualToolParameters = JSON.parse(toolCall.function.arguments);
    if (!_.isEqual(actualToolParameters, expectedToolCall.parameters)) {
      this.error(
        `Expected tool to be called with ${JSON.stringify(
          expectedToolCall.parameters
        )} but got ${JSON.stringify(actualToolParameters)}`
      );
    }

    this.log("✅ Tool call was successful");
  }
}
