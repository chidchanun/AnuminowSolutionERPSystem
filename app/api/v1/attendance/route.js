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

function canManageAttendance(user) {
    return ['Admin', 'Manager'].includes(user?.role)
}

function getTodayISO() {
    return new Date().toISOString().slice(0, 10)
}

function getWeekStartEnd() {
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day

    const monday = new Date(now)
    monday.setDate(now.getDate() + diffToMonday)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return {
        from: monday.toISOString().slice(0, 10),
        to: sunday.toISOString().slice(0, 10),
    }
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

        const week = getWeekStartEnd()
        const today = getTodayISO()

        const dateFrom = searchParams.get('from') || week.from
        const dateTo = searchParams.get('to') || week.to
        const selectedDate = searchParams.get('date') || today
        const departmentId = searchParams.get('department_id') || ''
        const userId = searchParams.get('user_id') || ''

        const where = [
            'u.deleted_at IS NULL',
        ]
        const values = []

        if (!canManageAttendance(user)) {
            where.push('u.id = ?')
            values.push(user.id)
        }

        if (departmentId && /^\d+$/.test(departmentId)) {
            where.push('u.department_id = ?')
            values.push(Number(departmentId))
        }

        if (userId.trim()) {
            where.push('u.id = ?')
            values.push(userId.trim())
        }

        const userWhereSql = where.join(' AND ')

        const [summaryRows] = await db.execute(
            `
            SELECT
                COALESCE(a.status, 'absent') AS status,
                COUNT(*) AS total
            FROM \`user\` u
            LEFT JOIN attendance a
                ON a.user_id = u.id
                AND a.work_date = ?
            WHERE ${userWhereSql}
            GROUP BY COALESCE(a.status, 'absent')
            `,
            [
                selectedDate,
                ...values,
            ]
        )

        const summary = {
            present: 0,
            late: 0,
            absent: 0,
            leave: 0,
        }

        summaryRows.forEach((row) => {
            summary[row.status] = Number(row.total || 0)
        })

        const [weeklyRows] = await db.execute(
            `
            SELECT
                a.work_date,
                SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended,
                SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) AS leave_count,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count
            FROM attendance a
            INNER JOIN \`user\` u
                ON u.id = a.user_id
            WHERE a.work_date BETWEEN ? AND ?
            AND ${userWhereSql}
            GROUP BY a.work_date
            ORDER BY a.work_date ASC
            `,
            [
                dateFrom,
                dateTo,
                ...values,
            ]
        )

        const [attendanceRows] = await db.execute(
            `
            SELECT
                a.attendance_id,
                a.user_id,
                a.work_date,
                a.check_in,
                a.check_out,
                a.status,
                a.note,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS full_name_th,
                u.email,
                d.department_name,
                r.role_name
            FROM attendance a
            INNER JOIN \`user\` u
                ON u.id = a.user_id
            LEFT JOIN department d
                ON d.department_id = u.department_id
            LEFT JOIN role r
                ON r.role_id = u.role_id
            WHERE a.work_date BETWEEN ? AND ?
            AND ${userWhereSql}
            ORDER BY a.work_date DESC, full_name_th ASC
            LIMIT 300
            `,
            [
                dateFrom,
                dateTo,
                ...values,
            ]
        )

        return NextResponse.json({
            success: true,
            date: selectedDate,
            range: {
                from: dateFrom,
                to: dateTo,
            },
            summary,
            weekly: weeklyRows,
            attendance: attendanceRows,
        })
    } catch (error) {
        console.error('Attendance GET error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดข้อมูล Attendance ไม่สำเร็จ',
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

        if (!canManageAttendance(user)) {
            return NextResponse.json(
                { success: false, message: 'คุณไม่มีสิทธิ์บันทึก Attendance' },
                { status: 403 }
            )
        }

        const body = await request.json()

        const {
            user_id,
            work_date,
            check_in = null,
            check_out = null,
            status = 'present',
            note = null,
        } = body

        if (!user_id || !work_date) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุพนักงานและวันที่' },
                { status: 400 }
            )
        }

        if (!['present', 'late', 'absent', 'leave'].includes(status)) {
            return NextResponse.json(
                { success: false, message: 'สถานะ Attendance ไม่ถูกต้อง' },
                { status: 400 }
            )
        }

        await db.execute(
            `
            INSERT INTO attendance (
                user_id,
                work_date,
                check_in,
                check_out,
                status,
                note,
                created_by,
                updated_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                check_in = VALUES(check_in),
                check_out = VALUES(check_out),
                status = VALUES(status),
                note = VALUES(note),
                updated_by = VALUES(updated_by)
            `,
            [
                user_id,
                work_date,
                check_in || null,
                check_out || null,
                status,
                note,
                user.id,
                user.id,
            ]
        )

        return NextResponse.json({
            success: true,
            message: 'บันทึก Attendance สำเร็จ',
        })
    } catch (error) {
        console.error('Attendance POST error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'บันทึก Attendance ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}