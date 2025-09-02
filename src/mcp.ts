import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-eval",
  version: "1.0.0",
});

Array.from({ length: 10 }).forEach((_, i) => {
  server.tool(
    `dummy#${i}`,
    "This is dummy tool",
    { arg: z.string() },
    (args) => {
      return {
        content: [{ type: "text", text: `Hello, ${args.arg}!` }],
      };
    }
  );
});

const transport = new StdioServerTransport();
server.connect(transport);
