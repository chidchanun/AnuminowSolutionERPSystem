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

export async function GET(request) {
    try {
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

        const { searchParams } =
            new URL(request.url)

        const limit = Math.min(
            Number(searchParams.get('limit') || 20),
            50
        )

        const [notifications] = await db.execute(
            `
            SELECT
                n.notification_id,
                n.user_id,
                n.type,
                n.title,
                n.message,
                n.link,
                n.source_table,
                n.source_id,
                n.created_by,
                n.read_at,
                n.created_at,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS created_by_name,
                u.picture_path AS created_by_picture
            FROM notification n
            LEFT JOIN user u
                ON u.id = n.created_by
            WHERE n.user_id = ?
            AND n.deleted_at IS NULL
            ORDER BY n.created_at DESC
            LIMIT ${limit}
            `,
            [user.id]
        )

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS unread_count
            FROM notification
            WHERE user_id = ?
            AND read_at IS NULL
            AND deleted_at IS NULL
            `,
            [user.id]
        )

        return NextResponse.json({
            success: true,
            notifications,
            unread_count: Number(
                countRows[0]?.unread_count || 0
            ),
        })
    } catch (error) {
        console.error('GET Notification Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด notification ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}

export async function PATCH(request) {
    try {
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

        await db.execute(
            `
            UPDATE notification
            SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
            AND read_at IS NULL
            AND deleted_at IS NULL
            `,
            [user.id]
        )

        return NextResponse.json({
            success: true,
            message: 'อ่าน notification ทั้งหมดแล้ว',
        })
    } catch (error) {
        console.error('PATCH Notification Error:', error)

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