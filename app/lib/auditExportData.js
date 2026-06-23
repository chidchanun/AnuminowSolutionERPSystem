import { db } from '@/app/lib/db'

export function safeJsonParse(value) {
    if (!value) return null
    if (typeof value === 'object') return value

    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

export function getAuditFilters(request) {
    const { searchParams } = new URL(request.url)

    return {
        search: searchParams.get('search') || '',
        actor_id: searchParams.get('actor_id') || '',
        action: searchParams.get('action') || '',
        entity_type: searchParams.get('entity_type') || '',
        entity_id: searchParams.get('entity_id') || '',
        from: searchParams.get('from') || '',
        to: searchParams.get('to') || '',
    }
}

export function formatAuditFilterValue(value) {
    return value || 'ทั้งหมด'
}

export function formatMetadata(metadata) {
    if (!metadata) return '-'

    return JSON.stringify(metadata, null, 2)
}

function buildAuditWhere(filters) {
    const where = []
    const values = []

    if (filters.actor_id?.trim()) {
        where.push('al.actor_id = ?')
        values.push(filters.actor_id.trim())
    }

    if (filters.action?.trim()) {
        where.push('al.action = ?')
        values.push(filters.action.trim())
    }

    if (filters.entity_type?.trim()) {
        where.push('al.entity_type = ?')
        values.push(filters.entity_type.trim())
    }

    if (filters.entity_id?.trim()) {
        where.push('al.entity_id = ?')
        values.push(filters.entity_id.trim())
    }

    if (filters.from && filters.to) {
        where.push('DATE(al.created_at) BETWEEN ? AND ?')
        values.push(filters.from, filters.to)
    } else if (filters.from) {
        where.push('DATE(al.created_at) >= ?')
        values.push(filters.from)
    } else if (filters.to) {
        where.push('DATE(al.created_at) <= ?')
        values.push(filters.to)
    }

    if (filters.search?.trim()) {
        where.push(`
            (
                al.summary LIKE ?
                OR al.action LIKE ?
                OR al.entity_type LIKE ?
                OR al.entity_id LIKE ?
            )
        `)

        const keyword = `%${filters.search.trim()}%`
        values.push(keyword, keyword, keyword, keyword)
    }

    return {
        whereSql: where.length > 0
            ? `WHERE ${where.join(' AND ')}`
            : '',
        values,
    }
}

export async function getAuditExportData({ filters }) {
    const { whereSql, values } = buildAuditWhere(filters)

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
        LIMIT 5000
        `,
        values
    )

    return {
        filters,
        generated_at: new Date().toISOString(),
        logs: rows.map((row) => ({
            ...row,
            metadata: safeJsonParse(row.metadata),
        })),
    }
}
