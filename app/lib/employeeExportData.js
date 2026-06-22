import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export async function getEmployeeExportAuthUser(request) {
    const accessToken = request.cookies.get('accessToken')?.value
    if (!accessToken) return null

    const payload = await safeVerifyToken(accessToken)
    if (!payload?.id) return null

    return {
        id: payload.id,
        role: payload.permission_role || 'Employee',
    }
}

export function canExportEmployee(user) {
    return ['Admin', 'Manager'].includes(user?.role)
}

export function getEmployeeExportFilters(request) {
    const { searchParams } = new URL(request.url)

    return {
        department_id: searchParams.get('department_id') || '',
        role_id: searchParams.get('role_id') || '',
        status: searchParams.get('status') || 'active',
        search: searchParams.get('search') || '',
    }
}

export async function getEmployeeExportData(filters) {
    const where = [
        'u.deleted_at IS NULL',
    ]
    const values = []

    if (filters.status && filters.status !== 'all') {
        where.push('u.status = ?')
        values.push(filters.status)
    }

    if (/^\d+$/.test(filters.department_id)) {
        where.push('u.department_id = ?')
        values.push(Number(filters.department_id))
    }

    if (/^\d+$/.test(filters.role_id)) {
        where.push('u.role_id = ?')
        values.push(Number(filters.role_id))
    }

    if (filters.search.trim()) {
        where.push(`
            (
                u.id LIKE ?
                OR u.email LIKE ?
                OR u.first_name_th LIKE ?
                OR u.last_name_th LIKE ?
                OR u.first_name_en LIKE ?
                OR u.last_name_en LIKE ?
                OR d.department_name LIKE ?
                OR r.role_name LIKE ?
            )
        `)

        const keyword = `%${filters.search.trim()}%`
        values.push(
            keyword,
            keyword,
            keyword,
            keyword,
            keyword,
            keyword,
            keyword,
            keyword
        )
    }

    const [rows] = await db.execute(
        `
        SELECT
            u.id,
            u.prefix,
            u.first_name_th,
            u.last_name_th,
            u.first_name_en,
            u.last_name_en,
            u.email,
            u.status,
            u.created_at,
            d.department_name,
            r.role_name
        FROM \`user\` u
        LEFT JOIN department d
            ON d.department_id = u.department_id
        LEFT JOIN role r
            ON r.role_id = u.role_id
        WHERE ${where.join(' AND ')}
        ORDER BY u.created_at DESC
        `,
        values
    )

    return {
        filters,
        generated_at: new Date().toISOString(),
        employees: rows,
    }
}

export function getEmployeeStatusLabel(status) {
    switch (status) {
        case 'active':
            return 'ทำงานอยู่'
        case 'inactive':
            return 'ปิดใช้งาน'
        case 'resigned':
            return 'ลาออก'
        default:
            return status || '-'
    }
}