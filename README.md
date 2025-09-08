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
@alpic-ai/mcp-eval/0.1.2 darwin-arm64 node-v22.17.1
$ mcp-eval --help [COMMAND]
USAGE
  $ mcp-eval COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`mcp-eval help [COMMAND]`](#mcp-eval-help-command)
* [`mcp-eval plugins`](#mcp-eval-plugins)
* [`mcp-eval plugins add PLUGIN`](#mcp-eval-plugins-add-plugin)
* [`mcp-eval plugins:inspect PLUGIN...`](#mcp-eval-pluginsinspect-plugin)
* [`mcp-eval plugins install PLUGIN`](#mcp-eval-plugins-install-plugin)
* [`mcp-eval plugins link PATH`](#mcp-eval-plugins-link-path)
* [`mcp-eval plugins remove [PLUGIN]`](#mcp-eval-plugins-remove-plugin)
* [`mcp-eval plugins reset`](#mcp-eval-plugins-reset)
* [`mcp-eval plugins uninstall [PLUGIN]`](#mcp-eval-plugins-uninstall-plugin)
* [`mcp-eval plugins unlink [PLUGIN]`](#mcp-eval-plugins-unlink-plugin)
* [`mcp-eval plugins update`](#mcp-eval-plugins-update)
* [`mcp-eval run TESTS`](#mcp-eval-run-tests)

## `mcp-eval help [COMMAND]`

Display help for mcp-eval.

```
USAGE
  $ mcp-eval help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for mcp-eval.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.2.32/src/commands/help.ts)_

## `mcp-eval plugins`

List installed plugins.

```
USAGE
  $ mcp-eval plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ mcp-eval plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/index.ts)_

## `mcp-eval plugins add PLUGIN`

Installs a plugin into mcp-eval.

```
USAGE
  $ mcp-eval plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into mcp-eval.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the MCP_EVAL_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the MCP_EVAL_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ mcp-eval plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ mcp-eval plugins add myplugin

  Install a plugin from a github url.

    $ mcp-eval plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ mcp-eval plugins add someuser/someplugin
```

## `mcp-eval plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ mcp-eval plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ mcp-eval plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/inspect.ts)_

## `mcp-eval plugins install PLUGIN`

Installs a plugin into mcp-eval.

```
USAGE
  $ mcp-eval plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into mcp-eval.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the MCP_EVAL_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the MCP_EVAL_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ mcp-eval plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ mcp-eval plugins install myplugin

  Install a plugin from a github url.

    $ mcp-eval plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ mcp-eval plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/install.ts)_

## `mcp-eval plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ mcp-eval plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ mcp-eval plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/link.ts)_

## `mcp-eval plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ mcp-eval plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ mcp-eval plugins unlink
  $ mcp-eval plugins remove

EXAMPLES
  $ mcp-eval plugins remove myplugin
```

## `mcp-eval plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ mcp-eval plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/reset.ts)_

## `mcp-eval plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ mcp-eval plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ mcp-eval plugins unlink
  $ mcp-eval plugins remove

EXAMPLES
  $ mcp-eval plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/uninstall.ts)_

## `mcp-eval plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ mcp-eval plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ mcp-eval plugins unlink
  $ mcp-eval plugins remove

EXAMPLES
  $ mcp-eval plugins unlink myplugin
```

## `mcp-eval plugins update`

Update installed plugins.

```
USAGE
  $ mcp-eval plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.4.46/src/commands/plugins/update.ts)_

## `mcp-eval run TESTS`

Run the test suite

```
USAGE
  $ mcp-eval run TESTS -u <value> -k <value> [-a anthropic/claude]

ARGUMENTS
  TESTS  YML file containing the test suite

FLAGS
  -a, --assistant=<option>        [default: anthropic/claude] Assistant configuration to use (impact model and system
                                  prompt)
                                  <options: anthropic/claude>
  -k, --openRouterApiKey=<value>  (required) OpenRouter API key to use
  -u, --url=<value>               (required) URL of the MCP server

DESCRIPTION
  Run the test suite

EXAMPLES
  $ mcp-eval run
```

_See code: [src/commands/run.ts](https://github.com/alpic-ai/mcp-eval/blob/v0.1.2/src/commands/run.ts)_
<!-- commandsstop -->
