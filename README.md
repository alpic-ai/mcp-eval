<h1>mcp-eval</h1>

A CLI to evaluate MCP servers performance

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)
[![Downloads/week](https://img.shields.io/npm/dw/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)

<!-- toc -->

- [Quick start](#quick-start)
- [Requirements](#requirements)
- [Usage](#usage)
- [Commands](#commands)
- [Assistant configuration](#assistant-configuration)
- [Test Suite Syntax](#test-suite-syntax)
<!-- tocstop -->

# Quick start

- Export your Openrouter API key as `OPENROUTER_API_KEY` environment variable``

```
$ export OPENROUTER_API_KEY=<your-key>
```

- Write your `myserver.yml` test case

```yml
test_cases:
  - name: "Open a contribution PR on Github"
    input_prompt: "I'd like to contribute to mcp-eval. I want to enable ... feature. I'll let you go ahead and implement the feature as you see fit. Open a pull request with the proposed modification once you're done."
    expected_tool_call:
      tool_name: "open-pr"
      parameters:
        branch: "new-feature"
```

- Run your test suite

```
$ npx -y @alpic-ai/mcp-eval@latest run --url=https://mcp.github.com ./myserver.yml
```

- Et voilà 🎉!

# Requirements

- Nodejs >= 22
- StreamableHTTP or SSE compatible public MCP server

# Usage

<!-- usage -->

```sh-session
$ npm install -g @alpic-ai/mcp-eval
$ mcp-eval COMMAND
running command...
$ mcp-eval (--version)
@alpic-ai/mcp-eval/0.9.0 darwin-arm64 node-v22.17.1
$ mcp-eval --help [COMMAND]
USAGE
  $ mcp-eval COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`mcp-eval run TESTFILE`](#mcp-eval-run-testfile)

## `mcp-eval run TESTFILE`

Run the test suite described in the provided YAML file.

```
USAGE
  $ mcp-eval run TESTFILE -u <value> [-a anthropic/claude]

ARGUMENTS
  TESTFILE  YAML file path containing the test suite

FLAGS
  -a, --assistant=<option>  [default: anthropic/claude] Assistant configuration to use (impact model and system prompt)
                            <options: anthropic/claude|openai/chatgpt>
  -u, --url=<value>         (required) URL of the MCP server

DESCRIPTION
  Run the test suite described in the provided YAML file.

EXAMPLES
  $ mcp-eval run
```

_See code: [src/commands/run.ts](https://github.com/alpic-ai/mcp-eval/blob/v0.9.0/src/commands/run.ts)_

<!-- commandsstop -->

# Assistant configuration

You can use the `-a` flag to specify the assistant configuration to use.

Currently, both `anthropic/claude` and `openai/chatgpt` are supported.

This will impact the model used, the system prompt and the default tools available to the assistant.

## anthropic/claude

- Model: `anthropic/claude-3.7-sonnet`
- Default tools: `drive_search`, `web_search`

## openai/chatgpt

- Model: `openai/gpt-5`
- Default tools: `bio`, `automations`, `canmore_create_textdoc`, `canmore_update_textdoc`, `canmore_comment_textdoc`, `file_search`, `image_gen`, `python`, `guardian_tool`, `web`

# Test Suite Syntax

Test suite should be written in YAML.
A test suite file should have a root `test_cases` property with at least one test.

Each test requires:

- `name`: a convenient name for your test
- `input_conversation`: the conversation to send to the assistant. This can be either a single user message or a multi-turn conversation containing both assistant and user messages. It can contain tool calls that already happened during the model thinking process.
- `expected_tool_call`: an object detailing the expected tool to be called with:
  - `tool_name`: the name as advertized by the MCP server of the tool to be called
  - `parameters`: the expected set of parameters the tool is expected to be called with. Only these specified properties will be checked during comparison with the actual tool call. Extra properties set by the model will not cause the test to fail.

## Simple user message example

```yml
test_cases:
  - name: "Find flights from Paris to Tokyo"
    input_prompt: "I'd like to plan a trip to Tokyo, Japan. Find me a flight from Paris to Tokyo on October 3rd and returning on October 5th."
    expected_tool_call:
      tool_name: "search-flight"
      parameters:
        flyFrom: Paris
        flyTo: Tokyo
        departureDate: 03/10/2025
        returnDate: 05/10/2025
```

## Multi-turn conversation example

```yml
test_cases:
  - name: "Create issue in frontend team for login bug"
    input_conversation:
      - role: user
        content: "I'm seeing a bug where the login button doesn't work. Can you create an issue for this?"
      - role: assistant
        content: "Sure, first let me check which team to assign the issue to. Listing your teams now."
      - role: tool
        tool_name: list_teams
        parameters: {}
        response: |
          [
            {"id": "team_123", "name": "Frontend"},
            {"id": "team_456", "name": "Backend"}
          ]
      - role: assistant
        content: "Now that I see the available teams, I'll assign the issue to the Frontend team."
    expected_tool_call:
      tool_name: "create_issue"
      parameters:
        title: "Login button doesn't work"
        description: "User reports that the login button is not functioning."
        team_id: "team_123"
```
