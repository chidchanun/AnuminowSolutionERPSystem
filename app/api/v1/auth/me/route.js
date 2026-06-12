import { NextResponse } from 'next/server'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export async function GET(request) {
  try {
    const token = request.cookies.get('accessToken')?.value
    if (!token) {
      return NextResponse.json({ message: 'ไม่พบ token' }, { status: 401 })
    }

    const payload = safeVerifyToken(token)
    if (!payload) {
      return NextResponse.json({ message: 'Token ไม่ถูกต้อง' }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: payload.id,
        department_name: payload.department_name,
        role_name: payload.role_name,
        picture_path: payload.picture_path,
        permission_role: payload.permission_role
      },
    })

  } catch (error) {
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
