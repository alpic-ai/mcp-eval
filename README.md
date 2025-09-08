<h1>mcp-eval</h1>

A CLI to evaluate MCP servers performance

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)
[![Downloads/week](https://img.shields.io/npm/dw/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)

<!-- toc -->
* [Quick start](#quick-start)
* [Requirements](#requirements)
* [Usage](#usage)
* [Commands](#commands)
* [Test Suite Syntax](#test-suite-syntax)
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
- StreamableHTTP compatible MCP server

# Usage

<!-- usage -->
```sh-session
$ npm install -g @alpic-ai/mcp-eval
$ mcp-eval COMMAND
running command...
$ mcp-eval (--version)
@alpic-ai/mcp-eval/0.5.2 darwin-arm64 node-v22.17.1
$ mcp-eval --help [COMMAND]
USAGE
  $ mcp-eval COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`mcp-eval run TESTFILE`](#mcp-eval-run-testfile)

## `mcp-eval run TESTFILE`

Run the test suite described in the provided YAML file.

```
USAGE
  $ mcp-eval run TESTFILE -u <value> [-a anthropic/claude]

ARGUMENTS
  TESTFILE  YAML file path containing the test suite

FLAGS
  -a, --assistant=<option>  [default: anthropic/claude] Assistant configuration to use (impact model and system prompt)
                            <options: anthropic/claude>
  -u, --url=<value>         (required) URL of the MCP server

DESCRIPTION
  Run the test suite described in the provided YAML file.

EXAMPLES
  $ mcp-eval run
```

_See code: [src/commands/run.ts](https://github.com/alpic-ai/mcp-eval/blob/v0.5.2/src/commands/run.ts)_
<!-- commandsstop -->

# Test Suite Syntax

Test suite should be written in YAML.
A test suite file should have a root `test_cases` property with at least one test.

Each test requires:

- `name`: a convenient name for your test
- `input_prompt`: the initial prompt to send to the assistant from which the response should be evaluated
- `expected_tool_call`: an object detailing the expected tool to be called with:
  - `tool_name`: the name as advertized by the MCP server of the tool to be called
  - `parameters`: the expected set of parameters the tool is expected to be called with

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
