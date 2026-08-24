import {
  infrastructureFailureResult,
  type LabExecutionProvider,
  type LabExecutionRequest,
  type LabExecutionResult,
} from './contracts.ts';

export type LabExecutionPhase = 'idle' | 'debouncing' | 'running' | 'settled';

export interface ReactiveLabState {
  generation: number;
  phase: LabExecutionPhase;
  request: LabExecutionRequest | null;
  result: LabExecutionResult | null;
}

export type ReactiveLabListener = (state: ReactiveLabState) => void;

export interface ReactiveLabExecutorOptions {
  debounceMs?: number;
  onStateChange: ReactiveLabListener;
}

export class ReactiveLabExecutor {
  #provider: LabExecutionProvider;
  #debounceMs: number;
  #onStateChange: ReactiveLabListener;
  #generation = 0;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #controller: AbortController | null = null;
  #request: LabExecutionRequest | null = null;
  #disposed = false;

  constructor(
    provider: LabExecutionProvider,
    { debounceMs = 180, onStateChange }: ReactiveLabExecutorOptions,
  ) {
    this.#provider = provider;
    this.#debounceMs = debounceMs;
    this.#onStateChange = onStateChange;
    this.#emit('idle', null);
  }

  setProvider(provider: LabExecutionProvider): void {
    this.#provider = provider;
    if (this.#request) this.update(this.#request);
  }

  update(request: LabExecutionRequest): number {
    if (this.#disposed) return this.#generation;
    this.#generation += 1;
    this.#request = request;
    this.#cancelPendingWork();
    const generation = this.#generation;
    this.#emit('debouncing', null);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#execute(generation, request);
    }, this.#debounceMs);
    return generation;
  }

  async flush(): Promise<void> {
    if (!this.#request || this.#disposed) return;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    await this.#execute(this.#generation, this.#request);
  }

  clear(): void {
    this.#generation += 1;
    this.#request = null;
    this.#cancelPendingWork();
    this.#emit('idle', null);
  }

  dispose(): void {
    this.#disposed = true;
    this.clear();
  }

  #cancelPendingWork(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#controller?.abort();
    this.#controller = null;
  }

  #emit(phase: LabExecutionPhase, result: LabExecutionResult | null): void {
    this.#onStateChange({
      generation: this.#generation,
      phase,
      request: this.#request,
      result,
    });
  }

  async #execute(
    generation: number,
    request: LabExecutionRequest,
  ): Promise<void> {
    if (this.#disposed || generation !== this.#generation) return;
    this.#controller?.abort();
    const controller = new AbortController();
    this.#controller = controller;
    this.#emit('running', null);
    let result: LabExecutionResult;
    try {
      if (!this.#provider.supports(request.runtime)) {
        result = {
          ...infrastructureFailureResult(
            request,
            this.#provider,
            'No provider is configured for this runtime.',
          ),
          status: 'infrastructure-failure',
          error: { message: 'No provider is configured for this runtime.' },
        };
      } else {
        result = await this.#provider.execute(request, {
          signal: controller.signal,
        });
      }
    } catch (error) {
      if (controller.signal.aborted || generation !== this.#generation) return;
      result = infrastructureFailureResult(request, this.#provider, error);
    }
    if (
      this.#disposed ||
      controller.signal.aborted ||
      generation !== this.#generation ||
      result.requestId !== request.requestId ||
      result.profileReleaseId !== request.runtime.profileReleaseId
    )
      return;
    this.#controller = null;
    this.#emit('settled', result);
  }
}
