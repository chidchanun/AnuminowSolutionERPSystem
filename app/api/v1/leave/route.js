import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'
import { createLeaveSubmittedNotifications } from '@/app/lib/leaveNotify'
import {
    hasPermission,
    hasPermissionKey,
    requirePermission,
} from '@/app/lib/permission'

export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'leave.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const canApprove = await hasPermission(
            user.id,
            'leave.approve'
        )

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status') || 'all'

        const where = [
            'lr.deleted_at IS NULL',
        ]
        const values = []

        if (!canApprove) {
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
                can_approve: canApprove,
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
        const auth = await requirePermission(
            request,
            'leave.create'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const body = await request.json()

        const {
            user_id,
            leave_type,
            start_date,
            end_date,
            reason = null,
        } = body

        const targetUserId =
            hasPermissionKey(user, 'leave.approve') && user_id
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

        const leaveId = result.insertId

        const notificationTargetUserIds =
            await createLeaveSubmittedNotifications({
                leaveId,
                requesterId: targetUserId,
                leaveType: leave_type,
                startDate: start_date,
                endDate: end_date,
                createdBy: user.id,
            })

        await emitNotificationToUsers(notificationTargetUserIds)

        return NextResponse.json({
            success: true,
            message: 'ส่งคำขอลาสำเร็จ',
            leave_id: leaveId,
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
