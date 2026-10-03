export const STORAGE_DEADLINE_MS = 5_000;
export const STORAGE_OPERATIONS = ["create", "read", "republish", "claim", "delete"] as const;
export type StorageOperation = typeof STORAGE_OPERATIONS[number];

/** Fixed diagnostics only: backend exceptions can contain briefs and credentials. */
export class StorageUnavailableError extends Error {
  readonly code = "GRILL_STORAGE_UNAVAILABLE";
  constructor(readonly operation: StorageOperation) { super(`room ${operation} storage unavailable`); }
}

export function unavailableOperation(error: unknown): StorageOperation | null {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "GRILL_STORAGE_UNAVAILABLE"
    || !("operation" in error) || !STORAGE_OPERATIONS.includes(error.operation as StorageOperation)) return null;
  return error.operation as StorageOperation;
}

/** One headers/body deadline. Timeout can follow a committed mutation. */
export async function storageRequest<T>(operation: StorageOperation, execute: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = STORAGE_DEADLINE_MS): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      execute(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new StorageUnavailableError(operation)); }, timeoutMs);
      }),
    ]);
  } catch { controller.abort(); throw new StorageUnavailableError(operation); }
  finally { clearTimeout(timer); }
}
