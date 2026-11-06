/**
 * Ejecucion de comandos con secretos aportados por el usuario.
 *
 * El cliente MCP solo declara QUE secretos necesita (nombre de variable y etiqueta).
 * El usuario escribe los valores en ArtiShell; los valores viajan al servidor por
 * stdin (no en la linea de comandos, que seria visible en `ps`), se exportan como
 * variables de entorno para el comando y se ocultan en stdout/stderr antes de
 * devolver el resultado. Nunca se devuelven al cliente MCP ni se registran.
 */

export const MAX_SECRETS = 8;
export const MAX_SECRET_LENGTH = 4096;
export const REDACTED = '***';

const SECRET_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;
const RESERVED_NAMES = new Set([
  'PATH', 'HOME', 'SHELL', 'USER', 'LOGNAME', 'IFS', 'PS1', 'PS2', 'PS4', 'ENV', 'BASH_ENV',
  'LD_PRELOAD', 'LD_LIBRARY_PATH', 'PROMPT_COMMAND', 'TERM', 'PWD', 'OLDPWD', 'CDPATH',
]);

export interface SecretSpec {
  /** Nombre de la variable de entorno que recibira el valor (MAYUSCULAS_CON_GUIONES). */
  name: string;
  /** Texto que vera el usuario en ArtiShell. */
  label: string;
  /** true (por defecto): se oculta al escribir y en la salida. false: dato no sensible, p. ej. un usuario. */
  sensitive?: boolean;
}

export interface NormalizedSecretSpec {
  name: string;
  label: string;
  sensitive: boolean;
}

export function normalizeSecretSpecs(raw: unknown): NormalizedSecretSpec[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('Se requiere al menos un secreto.');
  }
  if (raw.length > MAX_SECRETS) {
    throw new Error(`Se permiten como maximo ${MAX_SECRETS} secretos por comando.`);
  }

  const seen = new Set<string>();
  return raw.map((entry) => {
    const item = (entry ?? {}) as Partial<SecretSpec>;
    const name = String(item.name ?? '').trim();
    if (!SECRET_NAME.test(name) || name.startsWith('ARTISHELL_')) {
      throw new Error(`Nombre de secreto invalido: "${name}". Usa MAYUSCULAS, digitos y _ (sin prefijo ARTISHELL_).`);
    }
    if (RESERVED_NAMES.has(name)) {
      throw new Error(`El nombre ${name} esta reservado por el shell.`);
    }
    if (seen.has(name)) {
      throw new Error(`Secreto duplicado: ${name}.`);
    }
    seen.add(name);
    const label = String(item.label ?? '').trim().slice(0, 120) || name;
    return { name, label, sensitive: item.sensitive !== false };
  });
}

export function validateSecretValues(specs: NormalizedSecretSpec[], values: Record<string, string>): void {
  for (const spec of specs) {
    const value = values[spec.name];
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Falta el valor de ${spec.label}.`);
    }
    if (value.length > MAX_SECRET_LENGTH) {
      throw new Error(`El valor de ${spec.label} supera ${MAX_SECRET_LENGTH} caracteres.`);
    }
    if (/[\r\n\0]/.test(value)) {
      throw new Error(`El valor de ${spec.label} no puede contener saltos de linea.`);
    }
  }
}

/**
 * Construye el comando remoto: lee una linea de stdin por secreto, la exporta con
 * el nombre pedido y despues ejecuta el comando del usuario en un subshell.
 * Solo usa sintaxis POSIX (`read -r`, `export`), valida para sh, bash y zsh.
 */
export function buildSecretWrapper(specs: NormalizedSecretSpec[], command: string): string {
  const reads = specs
    .map((_spec, index) => `IFS= read -r __artishell_s${index} || exit 97`)
    .join('; ');
  const exports = specs
    .map((spec, index) => `${spec.name}=$__artishell_s${index}; export ${spec.name}; unset __artishell_s${index}`)
    .join('; ');
  return `${reads}; ${exports}; ( ${command}\n) </dev/null`;
}

export function buildSecretStdin(specs: NormalizedSecretSpec[], values: Record<string, string>): string {
  return specs.map((spec) => `${values[spec.name]}\n`).join('');
}

/** Reemplaza en el texto cualquier aparicion de los valores sensibles. */
export function redactSecrets(text: string, specs: NormalizedSecretSpec[], values: Record<string, string>): string {
  const secrets = specs
    .filter((spec) => spec.sensitive)
    .map((spec) => values[spec.name])
    .filter((value): value is string => typeof value === 'string' && value.length >= 3)
    .sort((a, b) => b.length - a.length);

  let result = text;
  for (const secret of secrets) {
    result = result.split(secret).join(REDACTED);
  }
  return result;
}
