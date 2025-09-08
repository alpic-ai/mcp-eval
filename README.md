mcp-eval
=================

A CLI to evaluate MCP servers performance


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)
[![Downloads/week](https://img.shields.io/npm/dw/mcp-eval.svg)](https://npmjs.org/package/mcp-eval)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @alpic-ai/mcp-eval
$ mcp-eval COMMAND
running command...
$ mcp-eval (--version)
@alpic-ai/mcp-eval/0.4.0 darwin-arm64 node-v22.17.1
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

_See code: [src/commands/run.ts](https://github.com/alpic-ai/mcp-eval/blob/v0.4.0/src/commands/run.ts)_
<!-- commandsstop -->
