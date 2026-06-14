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

        let sql = ''
        let params = []

        if (
            ['Admin', 'Manager'].includes(
                payload.permission_role
            )
        ) {
            sql = `
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
        } else {
            sql = `
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
                    ON p.project_id = pm.project_id
                WHERE
                    p.deleted_at IS NULL
                    AND pm.user_id = ?
                ORDER BY p.project_id DESC
            `

            params = [payload.id]
        }

        const [projects] =
            await db.execute(sql, params)

        return NextResponse.json({
            message: 'ok',
            status: 200,
            projects,
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            {
                message: 'Internal Server Error',
            },
            {
                status: 500,
            }
        )
    }
}


export async function POST(request) {
    try {
        const accessToken =
            request.cookies.get('accessToken')?.value

        if (!accessToken) {
            return NextResponse.json(
                { message: 'โปรดเข้าสู่ระบบใหม่อีกครั้ง' },
                { status: 401 }
            )
        }

        const payload =
            safeVerifyToken(accessToken)

        if (!payload) {
            return NextResponse.json(
                { message: 'โปรดเข้าสู่ระบบใหม่อีกครั้ง' },
                { status: 401 }
            )
        }

        const body = await request.json()

        const {
            project_name,
            project_code,
            description,
            start_date,
            end_date,
            member_ids = []
        } = body

        const [result] = await db.execute(
            `
      INSERT INTO project
      (
        project_name,
        project_code,
        description,
        start_date,
        end_date,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
            [
                project_name,
                project_code,
                description,
                start_date,
                end_date,
                payload.id
            ]
        )

        const projectId = result.insertId

        const memberSet = new Set([
            payload.id,
            ...member_ids
        ])

        const values = [...memberSet].map(
            userId => [projectId, userId]
        )

        await db.query(
            `
            INSERT INTO project_member
            (
                project_id,
                user_id
            )
            VALUES ?
            `,
            [values]
        )

        return NextResponse.json({
            success: true,
            project_id: projectId
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้างโปรเจ็กไม่สำเร็จ'
            },
            {
                status: 500
            }
        )
    }
}