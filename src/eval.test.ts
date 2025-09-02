import { describe, it, expect, vi } from "vitest";
import { Agent, run, setDefaultOpenAIKey, tool, Usage } from "@openai/agents";
import { z } from "zod";

setDefaultOpenAIKey("");

const constArgs = {
  object: z.string().describe("Title of the issue"),
  body: z.string().describe("Description of the issue"),
};

const additionalArgs = {
  labels: z.array(z.string()).describe("Labels of the issue").nullable(),
  assignees: z.array(z.string()).describe("Assignees of the issue").nullable(),
  milestone: z.string().describe("Milestone of the issue").nullable(),
  projects: z.array(z.string()).describe("Projects of the issue").nullable(),
  due_date: z.string().describe("Due date of the issue").nullable(),
  title: z.string().describe("Title of the issue").nullable(),
  description: z.string().describe("Description of the issue").nullable(),
  assignee: z.string().describe("Assignee of the issue").nullable(),
  project: z.string().describe("Project of the issue").nullable(),
  created_at: z.string().describe("Created at of the issue").nullable(),
  updated_at: z.string().describe("Updated at of the issue").nullable(),
  closed_at: z.string().describe("Closed at of the issue").nullable(),
  state: z.string().describe("State of the issue").nullable(),
  url: z.string().describe("URL of the issue").nullable(),
  html_url: z.string().describe("HTML URL of the issue").nullable(),
  comments: z.number().describe("Comments of the issue").nullable(),
};

function shuffleArray<T>(array: T[]) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

describe("eval", () => {
  const allToolsNameAndDescription: { name: string; description: string }[] = [
    // Perplexity MCP tools
    {
      name: "search",
      description:
        "Perform a web search using Perplexity's API, which provides detailed and contextually relevant results with citations. By default, no time filtering is applied to search results.",
    },
    // Github MCP tools - https://smithery.ai/server/%40smithery-ai%2Fgithub
    {
      name: "search_repositories",
      description:
        "Search for GitHub repositories. Returns a concise list with essential information. Use 'get_repository' for detailed information about a specific repository.",
    },
    {
      name: "search_code",
      description:
        "Search for code across GitHub repositories. Returns a concise list with file paths and repositories. Use 'get_file_contents' for full file content.",
    },
    {
      name: "search_users",
      description: "Search for GitHub users.",
    },
    {
      name: "get_issue",
      description: "Get details of a specific issue in a GitHub repository.",
    },
    {
      name: "add_issue_comment",
      description: "Add a comment to a specific issue in a GitHub repository.",
    },
    {
      name: "search_issues",
      description: "Search for issues in GitHub repositories.",
    },
    {
      name: "list_issues",
      description: "List issues in a GitHub repository.",
    },
    {
      name: "update_issue",
      description: "Update an existing issue in a GitHub repository.",
    },
    {
      name: "get_issue_comments",
      description: "Get comments for a specific issue in a GitHub repository.",
    },
    {
      name: "get_repository",
      description:
        "Get detailed information about a GitHub repository including README and file structure",
    },
    {
      name: "get_commit",
      description: "Get details for a commit from a GitHub repository",
    },
    {
      name: "get_commits",
      description: "Get list of commits of a branch in a GitHub repository",
    },
    {
      name: "list_branches",
      description: "List branches in a GitHub repository",
    },
    {
      name: "create_or_update_file",
      description:
        "Create or update a single file in a GitHub repository. If updating an existing file, you must provide the current SHA of the file (the full 40-character SHA, not a shortened version).",
    },
    {
      name: "create_repository",
      description: "Create a new GitHub repository in your account",
    },
    {
      name: "get_file_contents",
      description: "Get the contents of a file from a GitHub repository",
    },
    {
      name: "fork_repository",
      description:
        "Fork a GitHub repository to your account or specified organization",
    },
    {
      name: "create_branch",
      description: "Create a new branch in a GitHub repository",
    },
    {
      name: "list_tags",
      description: "List git tags in a GitHub repository",
    },
    {
      name: "get_tag",
      description:
        "Get details about a specific git tag in a GitHub repository",
    },
    {
      name: "push_files",
      description:
        "Push multiple files to a GitHub repository in a single commit",
    },
    {
      name: "get_pull_request",
      description:
        "Get details of a specific pull request in a GitHub repository.",
    },
    {
      name: "update_pull_request",
      description: "Update an existing pull request in a GitHub repository.",
    },
    {
      name: "list_pull_requests",
      description: "List pull requests in a GitHub repository.",
    },
    {
      name: "merge_pull_request",
      description: "Merge a pull request in a GitHub repository.",
    },
    {
      name: "get_pull_request_files",
      description: "Get the files changed in a specific pull request.",
    },
    {
      name: "get_pull_request_status",
      description: "Get the status of a specific pull request.",
    },
    {
      name: "update_pull_request_branch",
      description:
        "Update the branch of a pull request with the latest changes from the base branch (not implemented)",
    },
    {
      name: "get_pull_request_comments",
      description: "Get comments for a specific pull request",
    },
    {
      name: "create_pull_request",
      description: "Create a new pull request in a GitHub repository.",
    },
    // Notion MCP tools - https://smithery.ai/server/%40smithery%2Fnotion/tools
    {
      name: "list_databases",
      description: "List all databases the integration has access to",
    },
    {
      name: "query_database",
      description:
        "Query a database with optional filtering, sorting, and pagination",
    },
    {
      name: "create_database",
      description: "Create a new database in a parent page",
    },
    {
      name: "update_database",
      description:
        "Update an existing database's title, description, or properties",
    },
    {
      name: "get_page",
      description:
        "Get a Notion page by ID. Returns page metadata and properties, but NOT the actual content blocks. To get page content, use get-block-children with the page ID.",
    },
    {
      name: "create_page",
      description:
        "Create a new Notion page in a specific parent page or database",
    },
    {
      name: "update_page",
      description: "Update an existing page's properties",
    },
    {
      name: "get_block",
      description:
        "Retrieve a specific block by its ID. In Notion, everything is a block - pages are special blocks that contain other blocks (paragraphs, headings, lists, etc.).",
    },
    {
      name: "get_block_children",
      description:
        "Retrieve all child blocks within a page or block. In Notion, everything is a block - pages are special blocks that contain other blocks (paragraphs, headings, lists, etc.).",
    },
    {
      name: "append_block_children",
      description: "Append new children blocks to a parent block",
    },
    {
      name: "update_block",
      description: "Update an existing block",
    },
    {
      name: "get_comments",
      description:
        "Retrieve comments on a specific Notion block or page. IMPORTANT: This only returns comments attached directly to the specified ID. It does NOT search child blocks.",
    },
    {
      name: "get_all_comments",
      description:
        "Retrieve ALL comments from a Notion page by searching both the page itself and every block within the page. This is more comprehensive than get-comments as it finds comments attached to any block in the page.",
    },
    {
      name: "create_comment",
      description:
        "Create a new comment on a Notion page or specific block. Comments can be attached to: 1) An entire page (use page ID), or 2) A specific block within a page (use block ID). To reply to an existing comment thread, use the discussionId.",
    },
    // Figma MCP tools
    {
      name: "get_document_info",
      description: "Get detailed information about the current Figma document",
    },
    {
      name: "get_selection",
      description: "Get information about the current selection in Figma",
    },
    {
      name: "get_selection_details",
      description:
        "Get detailed information about the current selection in Figma, including all node details",
    },
    {
      name: "get_node",
      description: "Get detailed information about a specific node in Figma",
    },
    {
      name: "get_nodes",
      description: "Get detailed information about multiple nodes in Figma",
    },
    {
      name: "create_rectangle",
      description: "Create a new rectangle in Figma",
    },
    {
      name: "create_frame",
      description: "Create a new frame in Figma",
    },
    {
      name: "create_text",
      description: "Create a new text element in Figma",
    },
    {
      name: "set_fill_color",
      description:
        "Set the fill color of a node in Figma can be TextNode or FrameNode",
    },
    {
      name: "set_stroke_color",
      description: "Set the stroke color of a node in Figma",
    },
    {
      name: "move_node",
      description: "Move a node to a new position in Figma",
    },
    {
      name: "clone_node",
      description: "Clone an existing node in Figma",
    },
    {
      name: "resize_node",
      description: "Resize a node in Figma",
    },
    {
      name: "delete_node",
      description: "Delete a node from Figma",
    },
    {
      name: "delete_nodes",
      description: "Delete multiple nodes from Figma at once",
    },
    {
      name: "export_node",
      description: "Export a node as an image from Figma",
    },
    {
      name: "set_text_content",
      description: "Set the text content of an existing text node in Figma",
    },
    {
      name: "get_styles",
      description: "Get all styles from the current Figma document",
    },
    {
      name: "get_components",
      description: "Get all local components from the Figma document",
    },
    {
      name: "get_annotations",
      description:
        "Get all annotations in the current document or specific node",
    },
    {
      name: "create_annotation",
      description: "Create or update an annotation",
    },
    {
      name: "set_annotations",
      description: "Set multiple annotations parallelly in a node",
    },
    {
      name: "create_instance",
      description: "Create an instance of a component in Figma",
    },
    {
      name: "get_overrides",
      description:
        "Get all override properties from a selected component instance. These overrides can be applied to other instances, which will swap them to match the source component.",
    },
    {
      name: "apply_overrides",
      description:
        "Apply previously copied overrides to selected component instances. Target instances will be swapped to the source component and all copied override properties will be applied.",
    },
    {
      name: "set_corner_radius",
      description: "Set the corner radius of a node in Figma",
    },
    {
      name: "scan_text_nodes",
      description: "Scan all text nodes in the selected Figma node",
    },
    {
      name: "scan_child_nodes",
      description:
        "Scan for child nodes with specific types in the selected Figma node",
    },
    {
      name: "set_text_contents",
      description: "Set multiple text contents parallelly in a node",
    },
    {
      name: "set_layout_mode",
      description: "Set the layout mode and wrap behavior of a frame in Figma",
    },
    {
      name: "set_padding",
      description: "Set padding values for an auto-layout frame in Figma",
    },
    {
      name: "set_alignment",
      description:
        "Set primary and counter axis alignment for an auto-layout frame in Figma",
    },
    {
      name: "set_sizing_mode",
      description:
        "Set horizontal and vertical sizing modes for an auto-layout frame in Figma",
    },
    {
      name: "set_gap",
      description: "Set distance between children in an auto-layout frame",
    },
    {
      name: "get_reactions",
      description:
        "Get Figma Prototyping Reactions from multiple nodes. CRITICAL: The output MUST be processed using the 'reaction_to_connector_strategy' prompt IMMEDIATELY to generate parameters for connector lines via the 'create_connections' tool.",
    },
    {
      name: "set_default_connector",
      description: "Set a copied connector node as the default connector",
    },
    {
      name: "create_connections",
      description:
        "Create connections between nodes using the default connector style",
    },
    {
      name: "join_channel",
      description: "Join a specific channel to communicate with Figma",
    },
    // Linear MCP tools
    {
      name: "linear_getViewer",
      description: "Get information about the currently authenticated user",
    },
    {
      name: "linear_getOrganization",
      description: "Get information about the current Linear organization",
    },
    {
      name: "linear_getUsers",
      description: "Get a list of users in the Linear organization",
    },
    {
      name: "linear_getLabels",
      description: "Get a list of issue labels from Linear",
    },
    {
      name: "linear_getTeams",
      description: "Get a list of teams from Linear",
    },
    {
      name: "linear_getWorkflowStates",
      description: "Get workflow states for a team",
    },
    {
      name: "linear_getProjects",
      description: "Get a list of projects from Linear",
    },
    {
      name: "linear_createProject",
      description: "Create a new project in Linear",
    },
    {
      name: "linear_updateProject",
      description: "Update an existing project in Linear",
    },
    {
      name: "linear_addIssueToProject",
      description: "Add an existing issue to a project",
    },
    {
      name: "linear_getProjectIssues",
      description: "Get all issues associated with a project",
    },
    {
      name: "linear_getCycles",
      description: "Get a list of all cycles",
    },
    {
      name: "linear_getActiveCycle",
      description: "Get the currently active cycle for a team",
    },
    {
      name: "linear_addIssueToCycle",
      description: "Add an issue to a cycle",
    },
    {
      name: "linear_getIssues",
      description: "Get a list of recent issues from Linear",
    },
    {
      name: "linear_getIssueById",
      description: "Get a specific issue by ID or identifier (e.g., ABC-123)",
    },
    {
      name: "linear_searchIssues",
      description: "Search for issues with various filters",
    },
  ];

  const arraySize = 15;
  const additionalArgsSize = 15;
  it.each(
    Array.from({ length: 5 }, () => ({
      inputTools: shuffleArray(allToolsNameAndDescription).slice(0, arraySize),
      args: z.object({
        ...constArgs,
        ...Object.fromEntries(
          shuffleArray(Object.entries(additionalArgs)).slice(
            0,
            additionalArgsSize
          )
        ),
      }),
      quantityOfOtherTools: arraySize,
    }))
  )(
    "With $quantityOfOtherTools other tools",
    async ({ inputTools, args }) => {
      const targetToolExecuteSpy = vi.fn(() => {
        return {
          content: [
            { type: "text", text: `Successfully executed the correct tool.` },
          ],
        };
      });
      const otherToolExecuteSpy = vi.fn(() => {
        return {
          content: [{ type: "text", text: `Successfully executed.` }],
        };
      });

      const tools = [
        tool({
          name: "create_issue",
          description: "Create a new issue in a GitHub repository.",
          strict: true,
          parameters: args,
          execute: targetToolExecuteSpy,
        }),
        ...inputTools.map((nameAndDescription) =>
          tool({
            ...nameAndDescription,
            strict: true,
            parameters: args,
            execute: otherToolExecuteSpy,
          })
        ),
      ];

      const agent = new Agent({
        name: "Assistant",
        instructions: "You are a helpful assistant",
        modelSettings: { temperature: 0.0 },
        tools,
      });

      const result = await run(
        agent,
        "Create a new issue to solve the bug about function concurrency in the code of the dashboard project"
      );
      expect(targetToolExecuteSpy).toHaveBeenCalled();
      expect(otherToolExecuteSpy).not.toHaveBeenCalled();
    },
    15000
  );
});
