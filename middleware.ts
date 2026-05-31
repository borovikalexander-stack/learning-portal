import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

const cookieName = "session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return null;
  }

  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const homeUrl = new URL("/", request.url);
  const token = request.cookies.get(cookieName)?.value;
  const secretKey = getSecretKey();

  if (!token || !secretKey) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, secretKey);

    if (payload.role !== "ADMIN") {
      return NextResponse.redirect(homeUrl);
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*"]
};
