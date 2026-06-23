import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { writeAuditLog } from '@/app/lib/auditLog'

function getRequestMetadata(request) {
    return {
        ip:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            request.ip ||
            'Unknown',
        user_agent: request.headers.get('user-agent') || 'Unknown',
    }
}

export async function POST(request) {
    try {
        const requestMetadata = getRequestMetadata(request)
        // ดึง refresh token จาก cookies
        const refreshToken = request.cookies.get('refreshToken')?.value

        if (!refreshToken) {
            return NextResponse.json({ message: 'ออกจากระบบเรียบร้อยแล้ว' }, { status: 401 })
        }

        // ค้นหา user session จากฐานข้อมูล
        const [sessionRows] = await db.query(
            "SELECT user_id FROM user_session WHERE token = ? AND token_type = 'refresh'",
            [refreshToken]
        )
        const sessionData = sessionRows[0]

        if (sessionData) {
            // รีโว่ก (ทำเครื่องหมาย) token ในฐานข้อมูล แทนการลบ เพื่อเก็บบันทึก audit
            await db.query(
                "UPDATE user_session SET revoked_at = NOW() WHERE token = ? AND token_type = 'refresh'",
                [refreshToken]
            )

            await writeAuditLog({
                actorId: sessionData.user_id,
                action: 'auth.logout',
                entityType: 'auth',
                entityId: sessionData.user_id,
                summary: `${sessionData.user_id} logged out`,
                metadata: requestMetadata,
            })
        }

        // สร้าง response
        const response = NextResponse.json({ 
            message: 'ออกจากระบบสำเร็จ'
        }, { status: 200 })

        // ลบ access token cookie
        response.cookies.set('accessToken', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 0,
            path: '/'
        })

        // ลบ refresh token cookie
        response.cookies.set('refreshToken', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 0,
            path: '/'
        })

        return response
    } catch  {
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}
