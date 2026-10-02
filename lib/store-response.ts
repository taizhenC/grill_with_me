import { NextResponse } from "next/server";
import { StoreConfigurationError } from "./store-config";

export function storageUnavailable(error: unknown): NextResponse | null {
  if (!(error instanceof StoreConfigurationError)) return null;
  return NextResponse.json(
    { error: "room storage is unavailable; contact the deployment owner" },
    { status: 503 },
  );
}
