import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const auth = await requirePermission(request, 'audit.view')

        if (auth.response) return auth.response

        const [countRows] = await db.execute(
            `
            SELECT
                COUNT(*) AS total_logs,
                SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS today_logs,
                SUM(CASE WHEN action LIKE 'permission_%' THEN 1 ELSE 0 END) AS permission_logs,
                SUM(CASE WHEN action LIKE 'task.%' THEN 1 ELSE 0 END) AS task_logs
            FROM audit_log
            `
        )

        const [topActorRows] = await db.execute(
            `
            SELECT
                al.actor_id,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS actor_name,
                COUNT(*) AS total
            FROM audit_log al
            LEFT JOIN \`user\` u
                ON u.id = al.actor_id
            WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY al.actor_id, actor_name
            ORDER BY total DESC
            LIMIT 5
            `
        )

        const [actionRows] = await db.execute(
            `
            SELECT
                action,
                COUNT(*) AS total
            FROM audit_log
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY action
            ORDER BY total DESC
            LIMIT 5
            `
        )

        const [latestRows] = await db.execute(
            `
            SELECT
                al.audit_id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.summary,
                al.created_at,
                al.actor_id,
                CONCAT(u.first_name_th, ' ', u.last_name_th) AS actor_name
            FROM audit_log al
            LEFT JOIN \`user\` u
                ON u.id = al.actor_id
            ORDER BY al.created_at DESC, al.audit_id DESC
            LIMIT 5
            `
        )

        const counts = countRows[0] || {}

        return NextResponse.json({
            success: true,
            summary: {
                total_logs: Number(counts.total_logs || 0),
                today_logs: Number(counts.today_logs || 0),
                permission_logs: Number(counts.permission_logs || 0),
                task_logs: Number(counts.task_logs || 0),
            },
            top_actors: topActorRows.map((row) => ({
                ...row,
                total: Number(row.total || 0),
            })),
            top_actions: actionRows.map((row) => ({
                ...row,
                total: Number(row.total || 0),
            })),
            latest_logs: latestRows,
        })
    } catch (error) {
        console.error('Audit Summary GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดสรุป Audit Log ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}
