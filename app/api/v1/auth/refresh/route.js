import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import jwt from 'jsonwebtoken'

export async function POST(request) {
  try {
    const refreshToken =
      request.cookies.get('refreshToken')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { message: 'Refresh token missing' },
        { status: 401 }
      )
    }

    // ค้นหา Refresh Token ในฐานข้อมูล
    const [sessionRows] = await db.query(
      `
      SELECT *
      FROM user_session
      WHERE token = ?
      AND token_type = 'refresh'
      LIMIT 1
      `,
      [refreshToken]
    )

    const session = sessionRows[0]

    if (!session) {
      return NextResponse.json(
        { message: 'Invalid refresh token' },
        { status: 401 }
      )
    }

    // ตรวจสอบว่าโดน revoke หรือไม่
    if (session.revoked_at) {
      return NextResponse.json(
        { message: 'Token revoked' },
        { status: 401 }
      )
    }

    // ตรวจสอบวันหมดอายุ
    if (
      session.expired_at &&
      new Date(session.expired_at) < new Date()
    ) {
      return NextResponse.json(
        { message: 'Token expired' },
        { status: 401 }
      )
    }

    // ดึงข้อมูล User ล่าสุด
    const [userRows] = await db.query(
      `
      SELECT
        u.id,
        u.picture_path,
        d.department_name,
        r.role_name,
        up.permission_role_name
      FROM user u
      LEFT JOIN user_permission_role up ON u.permission_role_id = up.permission_role_id
      LEFT JOIN department d
        ON u.department_id = d.department_id
      LEFT JOIN role r
        ON u.role_id = r.role_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [session.user_id]
    )

    const user = userRows[0]

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }


    // สร้าง Access Token ใหม่
    const accessToken = jwt.sign(
      {
        id: user.id,
        department_name: user.department_name,
        role_name: user.role_name,
        picture_path: user.picture_path,
        permission_name : user.permission_role_name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h'
      }
    )

    const response = NextResponse.json(
      {
        message: 'Token refreshed successfully'
      },
      {
        status: 200
      }
    )

    // เซ็ต Access Token ใหม่
    response.cookies.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60,
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Refresh token error:', error)

    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    )
  }
}