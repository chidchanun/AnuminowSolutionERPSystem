import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasPermissionKey,
    requirePermission,
} from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeJsonParse(value) {
    if (!value) return null
    if (typeof value === 'object') return value

    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

function parseBoundedInt(value, fallback, min, max) {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) {
        return fallback
    }

    return Math.min(Math.max(Math.trunc(parsed), min), max)
}

function buildAuditWhere(searchParams) {
    const where = []
    const values = []

    const actorId = (searchParams.get('actor_id') || '').trim()
    if (actorId) {
        where.push('al.actor_id = ?')
        values.push(actorId)
    }

    const action = (searchParams.get('action') || '').trim()
    if (action) {
        where.push('al.action = ?')
        values.push(action)
    }

    const entityType = (searchParams.get('entity_type') || '').trim()
    if (entityType) {
        where.push('al.entity_type = ?')
        values.push(entityType)
    }

    const entityId = (searchParams.get('entity_id') || '').trim()
    if (entityId) {
        where.push('al.entity_id = ?')
        values.push(entityId)
    }

    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''

    if (from && to) {
        where.push('DATE(al.created_at) BETWEEN ? AND ?')
        values.push(from, to)
    } else if (from) {
        where.push('DATE(al.created_at) >= ?')
        values.push(from)
    } else if (to) {
        where.push('DATE(al.created_at) <= ?')
        values.push(to)
    }

    const search = (searchParams.get('search') || '').trim()
    if (search) {
        where.push(`
            (
                al.summary LIKE ?
                OR al.action LIKE ?
                OR al.entity_type LIKE ?
                OR al.entity_id LIKE ?
            )
        `)

        const keyword = `%${search}%`
        values.push(keyword, keyword, keyword, keyword)
    }

    return {
        whereSql: where.length > 0
            ? `WHERE ${where.join(' AND ')}`
            : '',
        values,
    }
}

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'audit.view')

        if (auth.response) return auth.response

        const user = auth.user

        const { searchParams } = new URL(request.url)
        const page = parseBoundedInt(
            searchParams.get('page'),
            1,
            1,
            Number.MAX_SAFE_INTEGER
        )
        const limit = parseBoundedInt(
            searchParams.get('limit'),
            20,
            1,
            100
        )
        const offset = (page - 1) * limit

        const { whereSql, values } = buildAuditWhere(searchParams)

        const [countRows] = await db.execute(
            `
            SELECT COUNT(*) AS total
            FROM audit_log al
            ${whereSql}
            `,
            values
        )

        const total = Number(countRows[0]?.total || 0)

        const [rows] = await db.execute(
            `
            SELECT
                al.audit_id,
                al.actor_id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.summary,
                al.metadata,
                al.created_at,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS actor_name,
                u.email AS actor_email
            FROM audit_log al
            LEFT JOIN \`user\` u
                ON u.id = al.actor_id
            ${whereSql}
            ORDER BY al.created_at DESC, al.audit_id DESC
            LIMIT ${limit}
            OFFSET ${offset}
            `,
            values
        )

        return NextResponse.json({
            success: true,
            data: rows.map((row) => ({
                ...row,
                metadata: safeJsonParse(row.metadata),
            })),
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
            permission: {
                can_export: hasPermissionKey(user, 'audit.export'),
            },
        })
    } catch (error) {
        console.error('Audit Log GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด Audit Log ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
