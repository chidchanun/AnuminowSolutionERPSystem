import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export const dynamic = 'force-dynamic'

async function getAuthUser(request) {
    const accessToken = request.cookies.get('accessToken')?.value
    if (!accessToken) return null

    const payload = await safeVerifyToken(accessToken)
    if (!payload?.id) return null

    return {
        id: payload.id,
        role: payload.permission_role || 'Employee',
    }
}

function canManageLeave(user) {
    return ['Admin', 'Manager'].includes(user?.role)
}

export async function GET(request) {
    try {
        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'all'

        const where = [
            'lr.deleted_at IS NULL',
        ]
        const values = []

        if (!canManageLeave(user)) {
            where.push('lr.user_id = ?')
            values.push(user.id)
        }

        if (
            status !== 'all' &&
            ['pending', 'approved', 'rejected'].includes(status)
        ) {
            where.push('lr.status = ?')
            values.push(status)
        }

        const [rows] = await db.execute(
            `
            SELECT
                lr.leave_id,
                lr.user_id,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status,
                lr.approved_by,
                lr.approved_at,
                lr.reject_reason,
                lr.created_at,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS full_name_th,
                u.email,
                d.department_name,
                r.role_name,

                CONCAT(au.first_name_th, ' ', au.last_name_th) AS approved_by_name
            FROM leave_request lr
            INNER JOIN \`user\` u
                ON u.id = lr.user_id
            LEFT JOIN department d
                ON d.department_id = u.department_id
            LEFT JOIN role r
                ON r.role_id = u.role_id
            LEFT JOIN \`user\` au
                ON au.id = lr.approved_by
            WHERE ${where.join(' AND ')}
            ORDER BY lr.created_at DESC
            LIMIT 300
            `,
            values
        )

        return NextResponse.json({
            success: true,
            leaves: rows,
            permission: {
                can_manage: canManageLeave(user),
            },
        })
    } catch (error) {
        console.error('Leave GET error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดรายการลาไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function POST(request) {
    try {
        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const body = await request.json()

        const {
            user_id,
            leave_type,
            start_date,
            end_date,
            reason = null,
        } = body

        const targetUserId =
            canManageLeave(user) && user_id
                ? user_id
                : user.id

        if (!leave_type || !start_date || !end_date) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกประเภทการลาและวันที่' },
                { status: 400 }
            )
        }

        if (!['sick', 'personal', 'vacation', 'other'].includes(leave_type)) {
            return NextResponse.json(
                { success: false, message: 'ประเภทการลาไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        if (new Date(start_date) > new Date(end_date)) {
            return NextResponse.json(
                { success: false, message: 'วันที่เริ่มลาต้องไม่เกินวันที่สิ้นสุด' },
                { status: 400 }
            )
        }

        const [result] = await db.execute(
            `
            INSERT INTO leave_request (
                user_id,
                leave_type,
                start_date,
                end_date,
                reason,
                status
            )
            VALUES (?, ?, ?, ?, ?, 'pending')
            `,
            [
                targetUserId,
                leave_type,
                start_date,
                end_date,
                reason,
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'ส่งคำขอลาสำเร็จ',
            leave_id: result.insertId,
        })
    } catch (error) {
        console.error('Leave POST error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ส่งคำขอลาไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}