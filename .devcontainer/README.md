# Dev Container — Claude Code Sandbox

## What Is This?

This is a [Dev Container](https://containers.dev/) configuration that provides a sandboxed environment for running [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) (Anthropic's AI coding agent) against the travel-platform codebase. It runs as a local Docker container on the developer's machine — it does **not** touch any shared infrastructure, staging, production, or CI/CD systems.

For Anthropic's official dev container reference, see: [Claude Code Dev Container Setup](https://docs.anthropic.com/en/docs/claude-code/bedrock-vertex#dev-container-reference-implementation)

## Why a Dev Container?

Claude Code executes shell commands, installs packages, and reads/writes files as part of its workflow. Running it inside a container provides:

- **Network isolation** — A firewall (iptables) restricts outbound traffic to a short allowlist (GitHub, npm registry, Anthropic API, VS Code marketplace). Everything else is blocked. Claude can't phone home to surprise destinations or exfiltrate data to unapproved endpoints.
- **Filesystem isolation** — Claude operates on a bind-mounted copy of the workspace. It can't reach the rest of your host filesystem.
- **Reproducibility** — Node 22, zsh, git-delta, fzf, and project dependencies (`npm ci`) are set up automatically. No "works on my machine" drift.

## Files in This Directory

| File                | Purpose                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `devcontainer.json` | Dev Container specification — image build config, VS Code extensions/settings, mounts, environment variables, lifecycle hooks |
| `Dockerfile`        | Container image definition — Node 22 base, dev tools, zsh with Powerlevel10k, git-delta, firewall tooling (iptables/ipset)    |
| `init-firewall.sh`  | Post-start script that configures iptables to drop all outbound traffic except an explicit allowlist                          |

## Network Allowlist

The firewall (`init-firewall.sh`) permits outbound traffic **only** to:

- **GitHub** — IPs fetched dynamically from `api.github.com/meta` (web, API, git ranges)
- **npm registry** — `registry.npmjs.org`
- **Anthropic API** — `api.anthropic.com`, `statsig.anthropic.com`, `statsig.com`, `sentry.io`
- **VS Code marketplace** — `marketplace.visualstudio.com`, `vscode.blob.core.windows.net`, `update.code.visualstudio.com`
- **DNS** (port 53), **SSH** (port 22), **localhost**, and the **host Docker network**

Everything else gets `REJECT`ed (not silently dropped — you'll get immediate feedback if something is blocked). The script verifies the firewall works by confirming `example.com` is unreachable and `api.github.com` is reachable.

⚠️ The container requires `NET_ADMIN` and `NET_RAW` capabilities (see `runArgs` in `devcontainer.json`). These are **container-scoped only** — they grant iptables privileges _inside the container_, not on your host machine.

## How to Use It

### Prerequisites

- Docker Desktop (or compatible runtime) running locally
- VS Code with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) **or** the [Dev Container CLI](https://github.com/devcontainers/cli)
- An Anthropic API key (for Claude Code to function)

### Option 1: VS Code

1. Open the travel-platform repo in VS Code
2. `Cmd+Shift+P` → "Dev Containers: Reopen in Container"
3. Wait for the build + `npm ci` to complete
4. Open a terminal — you're in zsh inside the container with Claude Code available

### Option 2: Dev Container CLI

```bash
# Install the CLI if you haven't
npm install -g @devcontainers/cli

# From the repo root
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . zsh
```

### 🔥 Cursor Does Not Work

The Dev Containers extension for **Cursor does not function** with this setup. If you use Cursor as your daily driver, use either the CLI approach above or open this repo in VS Code specifically for container-based Claude Code sessions.

## What Gets Mounted

| Mount                          | Type          | Purpose                                                                                         |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------- |
| Your local repo → `/workspace` | Bind mount    | The codebase. Changes you make inside the container are reflected on your host (and vice versa) |
| `claude-code-bashhistory-*`    | Docker volume | Persists shell history across container rebuilds                                                |
| `claude-code-config-*`         | Docker volume | Persists Claude Code config (`~/.claude`) across container rebuilds                             |

## Environment Variables

| Variable                         | Value                       | Purpose                                                            |
| -------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `NODE_OPTIONS`                   | `--max-old-space-size=4096` | Prevents OOM on large TypeScript compilations                      |
| `CLAUDE_CONFIG_DIR`              | `/home/node/.claude`        | Points Claude Code at the persisted config volume                  |
| `POWERLEVEL9K_DISABLE_GITSTATUS` | `true`                      | Avoids slow git status calls in the zsh prompt for this large repo |
| `DEVCONTAINER`                   | `true`                      | Lets scripts detect they're running inside the container           |

## Risk Assessment & Awareness

This is a local-only development tool:

- Runs entirely on the developer's local machine inside Docker. No cloud resources, no shared infrastructure.
- The Dockerfile pulls from public registries only (Docker Hub for `node:22`, GitHub releases for git-delta, npm for packages). No internal registry access required.
- The firewall script is _restrictive_, not _permissive_ — default policy is DROP. It narrows what the container can reach, it doesn't open anything up.
- `NET_ADMIN`/`NET_RAW` capabilities are scoped to the container. They cannot affect host networking.
- No ports are published to the host. No services are exposed.
- No secrets are baked into the image. The Anthropic API key is provided at runtime by the developer.
- This does not run in CI/CD, staging, or production. It's not referenced by any pipeline or deployment manifest.

Changes to the configuration need to go through Jim and/or John.
