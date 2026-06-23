import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { emitNotificationToUsers } from '@/app/lib/socketEmit'
import { createLeaveResultNotification } from '@/app/lib/leaveNotify'
import {
    hasPermissionKey,
    requirePermission,
} from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export const dynamic = 'force-dynamic'

function getDateRange(startDate, endDate) {
    const dates = []
    const current = new Date(startDate)
    const end = new Date(endDate)

    while (current <= end) {
        dates.push(current.toISOString().slice(0, 10))
        current.setDate(current.getDate() + 1)
    }

    return dates
}

export async function PATCH(request, context) {
    let connection

    try {
        const auth = await requirePermission(
            request,
            'leave.approve'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const { id } = await context.params
        const leaveId = Number(id)
        const body = await request.json()
        const {
            status,
            reject_reason = null,
        } = body

        if (!['approved', 'rejected'].includes(status)) {
            return NextResponse.json(
                { success: false, message: 'สถานะไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const [leaveRows] = await db.execute(
            `
            SELECT
                leave_id,
                user_id,
                leave_type,
                start_date,
                end_date,
                status
            FROM leave_request
            WHERE leave_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [leaveId]
        )

        const leave = leaveRows[0]

        if (!leave) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบคำขอลา' },
                { status: 404 }
            )
        }

        if (String(leave.user_id) === String(user.id)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่สามารถอนุมัติหรือปฏิเสธคำขอลาของตัวเองได้',
                },
                { status: 403 }
            )
        }

        if (leave.status !== 'pending') {
            return NextResponse.json(
                { success: false, message: 'รายการนี้ถูกดำเนินการแล้ว' },
                { status: 400 }
            )
        }

        connection = await db.getConnection()
        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE leave_request
            SET
                status = ?,
                approved_by = ?,
                approved_at = CURRENT_TIMESTAMP,
                reject_reason = ?
            WHERE leave_id = ?
            `,
            [
                status,
                user.id,
                status === 'rejected' ? reject_reason : null,
                leaveId,
            ]
        )

        if (status === 'approved') {
            const dates = getDateRange(
                leave.start_date,
                leave.end_date
            )

            for (const workDate of dates) {
                await connection.execute(
                    `
                    INSERT INTO attendance (
                        user_id,
                        work_date,
                        status,
                        note,
                        created_by,
                        updated_by
                    )
                    VALUES (?, ?, 'leave', 'Approved leave request', ?, ?)
                    ON DUPLICATE KEY UPDATE
                        status = 'leave',
                        note = 'Approved leave request',
                        updated_by = VALUES(updated_by)
                    `,
                    [
                        leave.user_id,
                        workDate,
                        user.id,
                        user.id,
                    ]
                )
            }
        }

        await writeAuditLog({
            connection,
            actorId: user.id,
            action: status === 'approved' ? 'leave.approve' : 'leave.reject',
            entityType: 'leave_request',
            entityId: leaveId,
            summary: `${status} leave request ${leaveId}`,
            metadata: {
                requester_id: leave.user_id,
                leave_type: leave.leave_type,
                start_date: leave.start_date,
                end_date: leave.end_date,
                reject_reason: status === 'rejected' ? reject_reason : null,
            },
        })

        const notificationTargetUserIds =
            await createLeaveResultNotification({
                connection,
                leaveId,
                requesterId: leave.user_id,
                approverId: user.id,
                leaveType: leave.leave_type,
                startDate: leave.start_date,
                endDate: leave.end_date,
                status,
            })
        await connection.commit()
        await emitNotificationToUsers(notificationTargetUserIds)
        return NextResponse.json({
            success: true,
            message:
                status === 'approved'
                    ? 'อนุมัติการลาสำเร็จ'
                    : 'ปฏิเสธการลาสำเร็จ',
        })
    } catch (error) {
        if (connection) await connection.rollback()

        console.error('Leave PATCH error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'อัปเดตคำขอลาไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    } finally {
        if (connection) connection.release()
    }
}

export async function DELETE(request, context) {
    try {
        const auth = await requirePermission(request, 'leave.view')

        if (auth.response) return auth.response

        const user = auth.user
        const { id } = await context.params
        const leaveId = Number(id)

        const [leaveRows] = await db.execute(
            `
            SELECT
                leave_id,
                user_id,
                status
            FROM leave_request
            WHERE leave_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [leaveId]
        )

        const leave = leaveRows[0]

        if (!leave) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบคำขอลา' },
                { status: 404 }
            )
        }

        const canDelete =
            hasPermissionKey(user, 'leave.approve') ||
            (
                String(leave.user_id) === String(user.id) &&
                leave.status === 'pending'
            )

        if (!canDelete) {
            return NextResponse.json(
                { success: false, message: 'คุณไม่มีสิทธิ์ลบคำขอนี้' },
                { status: 403 }
            )
        }

        await db.execute(
            `
            UPDATE leave_request
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE leave_id = ?
            `,
            [leaveId]
        )

        await writeAuditLog({
            actorId: user.id,
            action: 'leave.delete',
            entityType: 'leave_request',
            entityId: leaveId,
            summary: `Delete leave request ${leaveId}`,
            metadata: {
                requester_id: leave.user_id,
                previous_status: leave.status,
            },
        })

        return NextResponse.json({
            success: true,
            message: 'ลบคำขอลาสำเร็จ',
        })
    } catch (error) {
        console.error('Leave DELETE error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบคำขอลาไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
