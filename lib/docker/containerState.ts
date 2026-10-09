/**
 * Container Readiness
 *
 * Pure helpers that turn the `/api/docker` create response into a readiness
 * decision. Extracted from the wallet-connection hook so the three outcomes
 * (success, non-success response, thrown network error) are testable without a
 * browser environment.
 */

export interface ContainerCreationResponse {
  success?: boolean;
  containerName?: string;
  error?: string;
}

export interface ContainerReadyState {
  ready: boolean;
  containerName?: string;
  error?: string;
}

/**
 * Interpret a decoded `/api/docker` create response.
 *
 * Ready is reported only when the API explicitly returned success. The old
 * hook set ready to true in both the failure branch and the catch block, so
 * the editor treated a container that was never created as ready and every
 * file read failed one by one.
 */
export function interpretContainerCreationResponse(
  response: ContainerCreationResponse | null | undefined
): ContainerReadyState {
  if (response && response.success) {
    return { ready: true, containerName: response.containerName };
  }
  return {
    ready: false,
    error: response?.error || 'Container creation failed',
  };
}

export interface CreateContainerDeps {
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
  setContainerReady: (ready: boolean) => void;
  onInfo?: (message: string) => void;
  onError?: (message: string) => void;
}

/**
 * Create the wallet's container via `/api/docker` and report readiness.
 *
 * A non-success response, a non-OK HTTP status and a thrown network error all
 * leave the container not ready and surface an error; only an explicit success
 * sets it ready.
 */
export async function createContainerForWallet(
  walletAddress: string,
  deps: CreateContainerDeps
): Promise<ContainerReadyState> {
  const fetchFn = deps.fetchFn ?? fetch;

  try {
    const response = await fetchFn('/api/docker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', walletAddress }),
    });

    if (!response.ok) {
      const message = `Container API error: ${response.status} ${response.statusText}`;
      deps.setContainerReady(false);
      deps.onError?.(message);
      return { ready: false, error: message };
    }

    const data = (await response.json()) as ContainerCreationResponse;
    const state = interpretContainerCreationResponse(data);

    if (state.ready) {
      deps.onInfo?.(`Container created: ${state.containerName}`);
    } else {
      deps.onError?.(state.error || 'Container creation failed');
    }

    deps.setContainerReady(state.ready);
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = `Failed to create container: ${message}`;
    deps.setContainerReady(false);
    deps.onError?.(failure);
    return { ready: false, error: failure };
  }
}
