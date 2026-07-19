import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = secret ? await verifySessionToken(token, secret) : false;

  if (pathname.startsWith("/admin") && !authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }

  if (pathname === "/api/til" && req.method === "POST" && !authenticated) {
    return NextResponse.json({ error: "Unauthorized. Log in at /admin/login." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/til"],
};
