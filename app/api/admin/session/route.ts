import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = secret ? await verifySessionToken(token, secret) : false;
  return NextResponse.json({ authenticated });
}
