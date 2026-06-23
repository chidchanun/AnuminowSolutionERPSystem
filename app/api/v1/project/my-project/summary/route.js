import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasProjectWideAccess,
    requirePermission,
} from '@/app/lib/permission'

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'project.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        let query = ''
        let params = []

        if (hasProjectWideAccess(user)) {
            query = `
                SELECT
                    COUNT(*) total,
                    SUM(status='planning') planning,
                    SUM(status='active') active,
                    SUM(status='completed') completed,
                    SUM(status='cancelled') cancelled
                FROM project
                WHERE deleted_at IS NULL
            `
        }

        else {
            query = `
                SELECT
                    COUNT(DISTINCT p.project_id) total,
                    SUM(p.status='planning') planning,
                    SUM(p.status='active') active,
                    SUM(p.status='completed') completed,
                    SUM(p.status='cancelled') cancelled
                FROM project p

                LEFT JOIN project_member pm
                    ON pm.project_id = p.project_id

                WHERE
                    p.deleted_at IS NULL
                    AND (
                        p.created_by = ?
                        OR pm.user_id = ?
                    )
            `

            params = [
                user.id,
                user.id
            ]
        }

        const [rows] =
            await db.execute(query, params)

        return NextResponse.json({
            total: Number(rows[0].total || 0),
            planning: Number(rows[0].planning || 0),
            active: Number(rows[0].active || 0),
            completed: Number(rows[0].completed || 0),
            cancelled: Number(rows[0].cancelled || 0),
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            {
                message: 'Internal Server Error'
            },
            {
                status: 500
            }
        )
    }
}
