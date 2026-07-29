import { NextResponse } from "next/server";
import { metrics } from "../metrics";

export const runtime = "nodejs";

export async function GET() {
  const promText = metrics.getPrometheusFormat();
  
  return new NextResponse(promText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
