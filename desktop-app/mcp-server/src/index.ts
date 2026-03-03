#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCreateTool } from "./tools/create.js";
import { registerReadTool } from "./tools/read.js";
import { registerModifyTool } from "./tools/modify.js";
import { registerEditTool } from "./tools/edit.js";
import { registerDeleteTool } from "./tools/delete.js";
import { registerExportTool } from "./tools/export.js";
import { registerOpenTool } from "./tools/open.js";

const server = new McpServer({
  name: "excalidraw-mcp-server",
  version: "1.0.0",
});

// Register all tools
registerCreateTool(server);
registerReadTool(server);
registerModifyTool(server);
registerEditTool(server);
registerDeleteTool(server);
registerExportTool(server);
registerOpenTool(server);

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
