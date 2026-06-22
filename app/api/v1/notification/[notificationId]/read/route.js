import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

async function getAuthUser(request) {
    const token = request.cookies.get('accessToken')?.value

    if (!token) {
        return null
    }

    const payload = await safeVerifyToken(token)

    if (!payload) {
        return null
    }

    return {
        id: payload.id,
        role: payload.permission_role,
    }
}

export async function PATCH(request, { params }) {
    try {
        const { notificationId } = await params

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        if (
            !notificationId ||
            !/^\d+$/.test(String(notificationId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Notification ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        await db.execute(
            `
            UPDATE notification
            SET read_at = CURRENT_TIMESTAMP
            WHERE notification_id = ?
            AND user_id = ?
            AND deleted_at IS NULL
            `,
            [
                notificationId,
                user.id,
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'อ่าน notification แล้ว',
        })
    } catch (error) {
        console.error('PATCH Notification Read Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'อัปเดต notification ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}