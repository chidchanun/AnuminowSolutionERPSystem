import { NextResponse } from 'next/server'
import { safeVerifyToken } from '@/app/lib/verifiedToken'
import { routePermissions } from '@/app/lib/permission'

const publicRoutes = [
  '/login',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
]

export function proxy(request) {
  const { pathname } = request.nextUrl

  if (
    publicRoutes.some((route) =>
      pathname.startsWith(route)
    )
  ) {
    return NextResponse.next()
  }

  const accessToken =
    request.cookies.get('accessToken')?.value

  const refreshToken =
    request.cookies.get('refreshToken')?.value

  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(
      new URL('/login', request.url)
    )
  }

  if (!accessToken) {
    return NextResponse.next()
  }

  const payload =
    safeVerifyToken(accessToken)

  if (!payload) {
    return NextResponse.next()
  }

  const userRole =
    payload.permission_role

  const protectedRoute =
    routePermissions.find((route) =>
      pathname.startsWith(route.path)
    )

  if (
    protectedRoute &&
    !protectedRoute.roles.includes(userRole)
  ) {
    return NextResponse.redirect(
      new URL('/dashboard', request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}