import { NextResponse } from "next/server";

export const MAX_CLAIM_JSON_BYTES = 4 * 1024;
const BODY_TIMEOUT_MS = 10_000;

type BodyResult =
  | { ok: true; text: string }
  | { ok: false; response: NextResponse };

class BodyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Count received bytes, including when the length header is absent or false. */
export async function readRequestText(
  request: Request,
  maxBytes: number,
  timeoutMs = BODY_TIMEOUT_MS,
): Promise<BodyResult> {
  const reject = (message: string, status: number): BodyResult => ({
    ok: false,
    response: NextResponse.json({ errors: [message] }, { status }),
  });
  if (request.signal.aborted) {
    void request.body?.cancel().catch(() => {});
    return reject("request body interrupted", 400);
  }
  const tooLarge = `payload too large (limit ${maxBytes} bytes)`;
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
    void request.body?.cancel().catch(() => {});
    return reject(tooLarge, 413);
  }
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const interrupted = new Promise<never>((_, fail) => {
    timer = setTimeout(
      () => fail(new BodyError("request body timed out", 408)),
      timeoutMs,
    );
    abort = () => fail(new BodyError("request body interrupted", 400));
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
  });

  try {
    let received = 0;
    let text = "";
    for (;;) {
      const { value, done } = await Promise.race([reader.read(), interrupted]);
      if (request.signal.aborted) throw new BodyError("request body interrupted", 400);
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new BodyError(tooLarge, 413);
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text };
  } catch (error) {
    // A peer's cancellation hook must not extend our response deadline.
    void reader.cancel().catch(() => {});
    return error instanceof BodyError
      ? reject(error.message, error.status)
      : reject("body must be readable UTF-8", 400);
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
