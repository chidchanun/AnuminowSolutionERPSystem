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

        // Admin
        if (payload.permission_role === 'Admin') {
            query = `
                SELECT
                    p.project_id,
                    p.project_code,
                    p.project_name,
                    p.description,
                    p.start_date,
                    p.end_date,
                    p.status,
                    p.created_at,
                    u.first_name_th,
                    u.last_name_th
                FROM project p
                INNER JOIN user u
                    ON p.created_by = u.id
                WHERE p.deleted_at IS NULL
                ORDER BY p.project_id DESC
            `
        }

        // Manager
        else if (
            payload.permission_role === 'Manager'
        ) {
            query = `
                SELECT DISTINCT
                    p.project_id,
                    p.project_code,
                    p.project_name,
                    p.description,
                    p.start_date,
                    p.end_date,
                    p.status,
                    p.created_at,
                    u.first_name_th,
                    u.last_name_th
                FROM project p

                INNER JOIN user u
                    ON p.created_by = u.id

                LEFT JOIN project_member pm
                    ON pm.project_id = p.project_id

                WHERE
                    p.deleted_at IS NULL
                    AND (
                        p.created_by = ?
                        OR pm.user_id = ?
                    )

                ORDER BY p.project_id DESC
            `

            params = [
                payload.id,
                payload.id
            ]
        }

        // Team Lead / Employee
        else {
            query = `
                SELECT
                    p.project_id,
                    p.project_code,
                    p.project_name,
                    p.description,
                    p.start_date,
                    p.end_date,
                    p.status,
                    p.created_at,
                    u.first_name_th,
                    u.last_name_th
                FROM project p

                INNER JOIN user u
                    ON p.created_by = u.id

                INNER JOIN project_member pm
                    ON pm.project_id = p.project_id

                WHERE
                    p.deleted_at IS NULL
                    AND pm.user_id = ?

                ORDER BY p.project_id DESC
            `

            params = [payload.id]
        }

        const [projects] =
            await db.execute(query, params)

        return NextResponse.json({
            projects
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