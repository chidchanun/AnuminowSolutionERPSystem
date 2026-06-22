import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export async function getAttendanceExportAuthUser(request) {
    const accessToken = request.cookies.get('accessToken')?.value
    if (!accessToken) return null

    const payload = await safeVerifyToken(accessToken)
    if (!payload?.id) return null

    return {
        id: payload.id,
        role: payload.permission_role || 'Employee',
    }
}

export function canExportAttendance(user) {
    return ['Admin', 'Manager'].includes(user?.role)
}

function getTodayDate() {
    return new Date().toISOString().slice(0, 10)
}

function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function getDayDiff(from, to) {
    const start = new Date(from)
    const end = new Date(to)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0
    }

    return Math.ceil((end - start) / (1000 * 60 * 60 * 24))
}

export function getAttendanceExportFilters(request) {
    const { searchParams } = new URL(request.url)

    const today = getTodayDate()

    const from = searchParams.get('from') || searchParams.get('date') || today
    const to = searchParams.get('to') || searchParams.get('date') || from

    return {
        from: isValidDate(from) ? from : today,
        to: isValidDate(to) ? to : today,
        department_id: searchParams.get('department_id') || '',
        role_id: searchParams.get('role_id') || '',
        user_id: searchParams.get('user_id') || '',
        status: searchParams.get('status') || 'all',
    }
}

export function getAttendanceStatusLabel(status) {
    switch (status) {
        case 'present':
            return 'มาทำงาน'
        case 'late':
            return 'มาสาย'
        case 'absent':
            return 'ขาดงาน'
        case 'leave':
            return 'ลา'
        default:
            return status || '-'
    }
}

export async function getAttendanceExportData(filters) {
    if (new Date(filters.from) > new Date(filters.to)) {
        throw new Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')
    }

    const dayDiff = getDayDiff(filters.from, filters.to)

    if (dayDiff > 366) {
        throw new Error('Export ได้ไม่เกิน 366 วันต่อครั้ง')
    }

    const where = [
        'u.deleted_at IS NULL',
        "u.status = 'active'",
    ]

    const values = []

    if (/^\d+$/.test(String(filters.department_id))) {
        where.push('u.department_id = ?')
        values.push(Number(filters.department_id))
    }

    if (/^\d+$/.test(String(filters.role_id))) {
        where.push('u.role_id = ?')
        values.push(Number(filters.role_id))
    }

    if (filters.user_id?.trim()) {
        where.push('u.id = ?')
        values.push(filters.user_id.trim())
    }

    if (
        filters.status !== 'all' &&
        ['present', 'late', 'absent', 'leave'].includes(filters.status)
    ) {
        where.push("COALESCE(a.status, 'absent') = ?")
        values.push(filters.status)
    }

    const [rows] = await db.execute(
        `
        WITH RECURSIVE date_range AS (
            SELECT CAST(? AS DATE) AS work_date

            UNION ALL

            SELECT DATE_ADD(work_date, INTERVAL 1 DAY)
            FROM date_range
            WHERE work_date < CAST(? AS DATE)
        )
        SELECT
            dr.work_date,

            u.id AS user_id,
            CONCAT(u.first_name_th, ' ', u.last_name_th) AS full_name_th,
            CONCAT(u.first_name_en, ' ', u.last_name_en) AS full_name_en,
            u.email,

            d.department_name,
            r.role_name,

            a.attendance_id,
            DATE_FORMAT(a.check_in, '%H:%i') AS check_in_time,
            DATE_FORMAT(a.check_out, '%H:%i') AS check_out_time,
            COALESCE(a.status, 'absent') AS status,
            a.note
        FROM date_range dr
        CROSS JOIN \`user\` u
        LEFT JOIN attendance a
            ON a.user_id = u.id
            AND a.work_date = dr.work_date
        LEFT JOIN department d
            ON d.department_id = u.department_id
        LEFT JOIN role r
            ON r.role_id = u.role_id
        WHERE ${where.join(' AND ')}
        ORDER BY dr.work_date DESC, full_name_th ASC
        LIMIT 5000
        `,
        [
            filters.from,
            filters.to,
            ...values,
        ]
    )

    const summary = {
        present: 0,
        late: 0,
        absent: 0,
        leave: 0,
    }

    rows.forEach((row) => {
        summary[row.status] = (summary[row.status] || 0) + 1
    })

    return {
        filters,
        generated_at: new Date().toISOString(),
        summary,
        attendance: rows,
    }
}