export const DEFAULT_COMMAND_TIMEOUT_MS = 30_000;
export const MAX_COMMAND_TIMEOUT_MS = 120_000;
export const DEFAULT_COMMAND_OUTPUT_BYTES = 256 * 1024;
export const MAX_COMMAND_OUTPUT_BYTES = 1024 * 1024;

export interface RunCommandOptions {
  cwd?: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export interface CommandPolicyDecision {
  requiresConfirmation: boolean;
  reason: string;
}

const SAFE_COMMANDS = new Set([
  'awk',
  'cat',
  'date',
  'df',
  'du',
  'env',
  'free',
  'git',
  'grep',
  'head',
  'hostname',
  'id',
  'journalctl',
  'ls',
  'lsof',
  'netstat',
  'pgrep',
  'printf',
  'ps',
  'pwd',
  'sed',
  'ss',
  'stat',
  'tail',
  'uname',
  'uptime',
  'vmstat',
  'wc',
  'who',
  'whoami',
]);

const SAFE_GIT_SUBCOMMANDS = new Set([
  'branch',
  'diff',
  'log',
  'remote',
  'show',
  'status',
]);

const SAFE_SYSTEMCTL_SUBCOMMANDS = new Set([
  'cat',
  'is-active',
  'is-enabled',
  'list-dependencies',
  'list-timers',
  'list-unit-files',
  'list-units',
  'show',
  'status',
]);

const SAFE_DOCKER_SUBCOMMANDS = new Set([
  'container',
  'image',
  'images',
  'inspect',
  'logs',
  'network',
  'ps',
  'stats',
  'version',
  'volume',
]);

const DANGEROUS_CONTROL_PATTERN = /(?:^|[^\\])(?:;|&&|\|\||\||`|\$\(|>|<|\n)/;
const DANGEROUS_WORD_PATTERN = /\b(?:apt|apt-get|brew|chmod|chown|cp|curl|dd|dnf|docker\s+(?:compose\s+)?(?:exec|kill|restart|rm|run|start|stop)|kill|killall|mkdir|mv|nano|npm\s+(?:i|install|uninstall)|reboot|rm|rmdir|sed\s+-i|service\s+\S+\s+(?:restart|start|stop)|shutdown|systemctl\s+(?:disable|enable|mask|reload|restart|start|stop)|tee|touch|vi|vim|wget|yum)\b/i;

function clampPositiveInt(value: unknown, defaultValue: number, maxValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(maxValue, Math.max(1, Math.floor(parsed)));
}

export function normalizeRunCommandOptions(input: {
  cwd?: unknown;
  timeoutMs?: unknown;
  maxOutputBytes?: unknown;
}): RunCommandOptions {
  const cwd = typeof input.cwd === 'string' && input.cwd.trim()
    ? input.cwd.trim()
    : undefined;

  return {
    cwd,
    timeoutMs: clampPositiveInt(input.timeoutMs, DEFAULT_COMMAND_TIMEOUT_MS, MAX_COMMAND_TIMEOUT_MS),
    maxOutputBytes: clampPositiveInt(input.maxOutputBytes, DEFAULT_COMMAND_OUTPUT_BYTES, MAX_COMMAND_OUTPUT_BYTES),
  };
}

function tokenizeSimpleCommand(command: string): string[] {
  const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return tokens.map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function firstExecutable(tokens: string[]): { command: string; args: string[] } | null {
  let index = 0;
  while (tokens[index] && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) {
    index += 1;
  }

  const command = tokens[index];
  if (!command) {
    return null;
  }

  if (command === 'sudo') {
    return null;
  }

  return {
    command: command.split('/').pop() || command,
    args: tokens.slice(index + 1),
  };
}

export function classifyCommand(command: string): CommandPolicyDecision {
  const trimmed = command.trim();
  if (!trimmed) {
    return {
      requiresConfirmation: true,
      reason: 'Comando vacio',
    };
  }

  if (DANGEROUS_CONTROL_PATTERN.test(trimmed)) {
    return {
      requiresConfirmation: true,
      reason: 'Contiene operadores de shell o redireccionamientos',
    };
  }

  if (DANGEROUS_WORD_PATTERN.test(trimmed)) {
    return {
      requiresConfirmation: true,
      reason: 'Coincide con una operacion potencialmente mutable',
    };
  }

  const executable = firstExecutable(tokenizeSimpleCommand(trimmed));
  if (!executable) {
    return {
      requiresConfirmation: true,
      reason: 'No se pudo clasificar como comando de lectura',
    };
  }

  if (executable.command === 'git') {
    const subcommand = executable.args.find((arg) => !arg.startsWith('-'));
    return {
      requiresConfirmation: !subcommand || !SAFE_GIT_SUBCOMMANDS.has(subcommand),
      reason: subcommand && SAFE_GIT_SUBCOMMANDS.has(subcommand)
        ? 'Comando git de lectura'
        : 'Subcomando git no clasificado como lectura',
    };
  }

  if (executable.command === 'systemctl') {
    const subcommand = executable.args.find((arg) => !arg.startsWith('-'));
    return {
      requiresConfirmation: !subcommand || !SAFE_SYSTEMCTL_SUBCOMMANDS.has(subcommand),
      reason: subcommand && SAFE_SYSTEMCTL_SUBCOMMANDS.has(subcommand)
        ? 'Comando systemctl de lectura'
        : 'Subcomando systemctl no clasificado como lectura',
    };
  }

  if (executable.command === 'docker') {
    const subcommand = executable.args.find((arg) => !arg.startsWith('-'));
    return {
      requiresConfirmation: !subcommand || !SAFE_DOCKER_SUBCOMMANDS.has(subcommand),
      reason: subcommand && SAFE_DOCKER_SUBCOMMANDS.has(subcommand)
        ? 'Comando docker de lectura'
        : 'Subcomando docker no clasificado como lectura',
    };
  }

  return {
    requiresConfirmation: !SAFE_COMMANDS.has(executable.command),
    reason: SAFE_COMMANDS.has(executable.command)
      ? 'Comando de lectura reconocido'
      : 'Comando no reconocido como lectura',
  };
}
