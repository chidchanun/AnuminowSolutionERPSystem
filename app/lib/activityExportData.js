import { db } from '@/app/lib/db'
import {
    getAuthUserWithPermissions,
    hasPermissionKey,
    hasTaskRelatedAccess,
    hasTaskWideAccess,
} from '@/app/lib/permission'

const validActionTypes = [
    'create',
    'update',
    'assign',
    'unassign',
    'status_change',
    'comment',
    'delete',
]

export async function getActivityAuthUser(request) {
    const user = await getAuthUserWithPermissions(request)

    if (!user) return null

    const [rows] = await db.execute(
        `
        SELECT
            u.id,
            CONCAT(
                u.first_name_th,
                ' ',
                u.last_name_th
            ) AS full_name,
            r.role_name
        FROM \`user\` u
        LEFT JOIN role r
            ON r.role_id = u.role_id
        WHERE u.id = ?
        LIMIT 1
        `,
        [user.id]
    )

    return {
        ...user,
        full_name:
            rows[0]?.full_name ||
            user.id,
        role_name:
            rows[0]?.role_name ||
            user.permission_role_name,
    }
}

export function canExportActivity(user) {
    return hasPermissionKey(user, 'activity.export')
}

export function getActivityFilters(request) {
    const { searchParams } =
        new URL(request.url)

    return {
        action_type:
            searchParams.get('action_type') || 'all',
        project_id:
            searchParams.get('project_id') || '',
        task_id:
            searchParams.get('task_id') || '',
        action_by:
            searchParams.get('action_by') || '',
        from:
            searchParams.get('from') || '',
        to:
            searchParams.get('to') || '',
    }
}

export function getActionLabel(actionType) {
    switch (actionType) {
        case 'create':
            return 'สร้าง'
        case 'update':
            return 'แก้ไข'
        case 'assign':
            return 'มอบหมาย'
        case 'unassign':
            return 'ยกเลิกมอบหมาย'
        case 'status_change':
            return 'เปลี่ยนสถานะ'
        case 'comment':
            return 'Comment'
        case 'delete':
            return 'ลบ'
        default:
            return actionType || '-'
    }
}

export function formatFilterValue(key, value) {
    if (!value || value === 'all') {
        return 'ทั้งหมด'
    }

    if (key === 'action_type') {
        return getActionLabel(value)
    }

    return value
}

function buildActivityWhere({
    user,
    filters,
}) {
    const where = []
    const values = []

    const userId = user.id

    const canViewAll = hasTaskWideAccess(user)
    const canViewRelated = hasTaskRelatedAccess(user)

    if (!canViewAll && canViewRelated) {
        where.push(`
            (
                t.created_by = ?
                OR p.created_by = ?
                OR EXISTS (
                    SELECT 1
                    FROM project_member pm_scope
                    WHERE pm_scope.project_id = t.project_id
                    AND pm_scope.user_id = ?
                )
                OR EXISTS (
                    SELECT 1
                    FROM task_assignment ta_scope
                    WHERE ta_scope.task_id = t.task_id
                    AND ta_scope.user_id = ?
                )
            )
        `)

        values.push(userId, userId, userId, userId)
    }

    if (!canViewAll && !canViewRelated) {
        where.push(`
            EXISTS (
                SELECT 1
                FROM task_assignment ta_scope
                WHERE ta_scope.task_id = t.task_id
                AND ta_scope.user_id = ?
            )
        `)

        values.push(userId)
    }

    if (
        filters.action_type !== 'all' &&
        validActionTypes.includes(filters.action_type)
    ) {
        where.push('th.action_type = ?')
        values.push(filters.action_type)
    }

    if (/^\d+$/.test(String(filters.project_id))) {
        where.push('t.project_id = ?')
        values.push(Number(filters.project_id))
    }

    if (/^\d+$/.test(String(filters.task_id))) {
        where.push('th.task_id = ?')
        values.push(Number(filters.task_id))
    }

    if (filters.action_by?.trim()) {
        where.push('th.action_by = ?')
        values.push(filters.action_by.trim())
    }

    if (filters.from && filters.to) {
        where.push('DATE(th.created_at) BETWEEN ? AND ?')
        values.push(filters.from, filters.to)
    } else if (filters.from) {
        where.push('DATE(th.created_at) >= ?')
        values.push(filters.from)
    } else if (filters.to) {
        where.push('DATE(th.created_at) <= ?')
        values.push(filters.to)
    }

    return {
        whereSql:
            where.length > 0
                ? `WHERE ${where.join(' AND ')}`
                : '',
        values,
    }
}

export async function getActivityExportData({
    user,
    filters,
}) {
    const {
        whereSql,
        values,
    } = buildActivityWhere({
        user,
        filters,
    })

    const [rows] = await db.execute(
        `
        SELECT
            th.history_id,
            th.task_id,
            th.target_table,
            th.target_column,
            th.action_type,
            th.old_value,
            th.new_value,
            th.description,
            th.action_by,
            th.created_at,

            t.task_name,
            t.project_id,

            p.project_name,
            p.project_code,

            CONCAT(
                u.first_name_th,
                ' ',
                u.last_name_th
            ) AS action_by_name

        FROM task_history th
        INNER JOIN task t
            ON t.task_id = th.task_id
        LEFT JOIN project p
            ON p.project_id = t.project_id
        LEFT JOIN \`user\` u
            ON u.id = th.action_by
        ${whereSql}
        ORDER BY th.created_at DESC
        LIMIT 5000
        `,
        values
    )

    return {
        filters,
        generated_at: new Date().toISOString(),
        activities: rows,
    }
}
