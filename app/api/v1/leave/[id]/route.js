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
        const { id } = await context.params
        const leaveId = Number(id)

        if (!leaveId) {
            return NextResponse.json(
                { success: false, message: 'Leave ID ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

        if (!canManageLeave(user)) {
            return NextResponse.json(
                { success: false, message: 'คุณไม่มีสิทธิ์อนุมัติการลา' },
                { status: 403 }
            )
        }

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

        await connection.commit()

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
        const { id } = await context.params
        const leaveId = Number(id)

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            )
        }

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
            canManageLeave(user) ||
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