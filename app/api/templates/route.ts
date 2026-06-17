import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/templates/registry";

export async function GET() {
  return NextResponse.json(listTemplates());
}
