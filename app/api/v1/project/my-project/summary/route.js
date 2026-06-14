import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'

export async function GET(request) {
    try {
        const accessToken =
            request.cookies.get('accessToken')?.value

        if (!accessToken) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            )
        }

        const payload =
            safeVerifyToken(accessToken)

        if (!payload) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            )
        }

        let query = ''
        let params = []

        if (payload.permission_role === 'Admin') {
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

        else if (
            payload.permission_role === 'Manager'
        ) {
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
                payload.id,
                payload.id
            ]
        }

        else {
            query = `
                SELECT
                    COUNT(*) total,
                    SUM(p.status='planning') planning,
                    SUM(p.status='active') active,
                    SUM(p.status='completed') completed,
                    SUM(p.status='cancelled') cancelled
                FROM project p

                INNER JOIN project_member pm
                    ON pm.project_id = p.project_id

                WHERE
                    p.deleted_at IS NULL
                    AND pm.user_id = ?
            `

            params = [payload.id]
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