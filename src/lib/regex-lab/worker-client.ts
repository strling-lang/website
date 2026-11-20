import { limits } from './interactive.ts';

type WorkerReply<Response> =
  | { type: 'ready' }
  | { type: 'result'; value: Response }
  | { type: 'failure'; message: string };
type WorkerEnvelope<T> = T & { exchange: string };

export class WorkerTimeout extends Error {}

export class LabWorker<Input, Output> {
  #worker: Worker | undefined;
  #cancel: (() => void) | undefined;
  #ready = false;

  constructor(
    private readonly create: () => Worker,
    private readonly timeout: number,
    private readonly initializeTimeout: () => number = () =>
      limits.initializationMs,
  ) {}

  run(input: Input, signal: AbortSignal): Promise<Output> {
    this.#cancel?.();
    if (signal.aborted) return Promise.reject(signal.reason);
    const worker = (this.#worker ??= this.create());
    const exchange = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        this.#cancel = undefined;
      };
      const fail = (error: unknown) => {
        finish();
        worker.terminate();
        this.#worker = undefined;
        this.#ready = false;
        reject(error);
      };
      const cancel = () =>
        fail(new DOMException('Run cancelled.', 'AbortError'));
      const expire = () =>
        fail(
          new WorkerTimeout(
            'The worker exceeded its time limit and was stopped.',
          ),
        );
      let timer = setTimeout(
        expire,
        this.#ready ? this.timeout : this.initializeTimeout(),
      );
      this.#cancel = cancel;
      signal.addEventListener('abort', cancel, { once: true });
      worker.onerror = () =>
        fail(new Error('The worker could not start or stopped unexpectedly.'));
      worker.onmessageerror = () =>
        fail(new Error('The worker returned an unreadable response.'));
      let acknowledged = false;
      worker.onmessage = ({
        data,
      }: MessageEvent<WorkerEnvelope<WorkerReply<Output>>>) => {
        if (!data || data.exchange !== exchange) {
          fail(new Error('The worker reply did not match the active request.'));
          return;
        }
        switch (data.type) {
          case 'ready':
            if (acknowledged) {
              fail(new Error('The worker repeated its acknowledgement.'));
              break;
            }
            acknowledged = true;
            this.#ready = true;
            clearTimeout(timer);
            timer = setTimeout(expire, this.timeout);
            break;
          case 'failure':
            fail(
              new Error(
                typeof data.message === 'string'
                  ? data.message
                  : 'The worker failed.',
              ),
            );
            break;
          case 'result':
            if (!acknowledged) {
              fail(
                new Error(
                  'The worker returned a result before acknowledgement.',
                ),
              );
              break;
            }
            finish();
            resolve(data.value);
            break;
          default:
            fail(new Error('The worker returned an unknown response.'));
        }
      };
      try {
        worker.postMessage({ exchange, input });
      } catch (error) {
        fail(error);
      }
    });
  }

  dispose() {
    this.#cancel?.();
    this.#worker?.terminate();
    this.#worker = undefined;
    this.#ready = false;
  }
}

export function serveWorker<Input, Output>(
  prepare: (input: Input) => Promise<void>,
  execute: (input: Input) => Output | Promise<Output>,
) {
  globalThis.addEventListener(
    'message',
    async ({ data }: MessageEvent<WorkerEnvelope<{ input: Input }>>) => {
      if (
        !data ||
        typeof data.exchange !== 'string' ||
        !Object.hasOwn(data, 'input')
      )
        return;
      const { exchange, input } = data;
      try {
        await prepare(input);
        globalThis.postMessage({ type: 'ready', exchange });
        globalThis.postMessage({
          type: 'result',
          exchange,
          value: await execute(input),
        });
      } catch (error) {
        globalThis.postMessage({
          type: 'failure',
          exchange,
          message:
            error instanceof Error ? error.message : 'The worker failed.',
        });
      }
    },
  );
}
