import { NextResponse } from "next/server";
import { StoreConfigurationError } from "./store-config";
import { unavailableOperation } from "./storage-failure";

export function storageUnavailable(error: unknown): NextResponse | null {
  const configuration = error instanceof StoreConfigurationError;
  const operation = unavailableOperation(error);
  if (!configuration && !operation) return null;
  console.error(JSON.stringify({ event: "room_storage_unavailable", operation: operation ?? "configuration" }));
  return NextResponse.json(
    { error: configuration ? "room storage is unavailable; contact the deployment owner"
      : "room storage is unavailable; check the previous outcome before retrying a write" },
    { status: 503, headers: { "cache-control": "no-store", "retry-after": "5" } },
  );
}
