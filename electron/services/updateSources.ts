export const GITHUB_REPOSITORY_OWNER = 'JavierValdez';
export const GITHUB_REPOSITORY_NAME = 'JaviServer';
export const GITHUB_RELEASES_BASE_URL = `https://github.com/${GITHUB_REPOSITORY_OWNER}/${GITHUB_REPOSITORY_NAME}`;
export const GCS_RELEASES_BASE_URL = 'https://storage.googleapis.com/artictools-releases/javiserver/releases';

export const UPDATE_SOURCE_CONFIGS = {
  github: {
    provider: 'github' as const,
    owner: GITHUB_REPOSITORY_OWNER,
    repo: GITHUB_REPOSITORY_NAME,
  },
  gcs: {
    provider: 'generic' as const,
    url: GCS_RELEASES_BASE_URL,
  },
};

export type UpdateSourceId = keyof typeof UPDATE_SOURCE_CONFIGS;

export const UPDATE_SOURCE_LABELS: Record<UpdateSourceId, string> = {
  github: 'GitHub Releases',
  gcs: 'Cloud Storage',
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class UpdateSourcesUnavailableError extends Error {
  constructor(
    public readonly githubError: unknown,
    public readonly gcsError: unknown,
  ) {
    super(
      `No se pudieron consultar las fuentes de actualizacion. `
      + `GitHub: ${getErrorMessage(githubError)}. `
      + `Cloud Storage: ${getErrorMessage(gcsError)}.`,
    );
    this.name = 'UpdateSourcesUnavailableError';
  }
}

function requireCheckResult<T>(result: T | null, source: UpdateSourceId): T {
  if (result === null) {
    throw new Error(`${UPDATE_SOURCE_LABELS[source]} no devolvio una respuesta valida.`);
  }
  return result;
}

export async function checkWithUpdateSourceFallback<T>(
  check: (source: UpdateSourceId) => Promise<T | null>,
  onFallback?: (githubError: unknown) => void,
): Promise<{ result: T; source: UpdateSourceId }> {
  let githubError: unknown;
  try {
    return {
      result: requireCheckResult(await check('github'), 'github'),
      source: 'github',
    };
  } catch (error) {
    githubError = error;
    onFallback?.(error);
  }

  try {
    return {
      result: requireCheckResult(await check('gcs'), 'gcs'),
      source: 'gcs',
    };
  } catch (gcsError) {
    throw new UpdateSourcesUnavailableError(githubError, gcsError);
  }
}

function encodeAssetPath(assetPath: string): string {
  return assetPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export function resolveUpdateAssetUrl(input: {
  assetUrl: string;
  source: UpdateSourceId;
  version: string;
  tag?: string;
}): string {
  if (/^https?:\/\//.test(input.assetUrl)) {
    return input.assetUrl;
  }

  const assetPath = input.assetUrl.replace(/^\/+/, '');
  if (input.source === 'github') {
    const tag = input.tag?.trim() || `v${input.version}`;
    return `${GITHUB_RELEASES_BASE_URL}/releases/download/${encodeURIComponent(tag)}/${encodeAssetPath(assetPath.replace(/ /g, '-'))}`;
  }

  return `${GCS_RELEASES_BASE_URL}/${encodeAssetPath(assetPath)}`;
}
