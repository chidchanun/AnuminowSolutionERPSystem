import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'

export async function GET(
    request,
    { params }
) {
    try {
        const { id } = await params

        const [rows] = await db.execute(
            `
      SELECT *
      FROM project
      WHERE project_id = ?
      AND deleted_at IS NULL
      `,
            [id]
        )

        if (rows.length === 0) {
            return NextResponse.json(
                { message: 'Project not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(rows[0])
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request,
    { params }
) {
    try {
        const user = await getCurrentUser()

        if (
            !['Admin', 'Manager'].includes(
                user.permission_role
            )
        ) {
            return NextResponse.json(
                { message: 'Forbidden' },
                { status: 403 }
            )
        }

        const { id } = await params

        const body = await request.json()

        const {
            project_name,
            project_code,
            description,
            start_date,
            end_date,
            status
        } = body

        await db.execute(
            `
      UPDATE project
      SET
        project_name = ?,
        project_code = ?,
        description = ?,
        start_date = ?,
        end_date = ?,
        status = ?
      WHERE project_id = ?
      `,
            [
                project_name,
                project_code,
                description,
                start_date,
                end_date,
                status,
                id
            ]
        )

        return NextResponse.json({
            message: 'Project updated'
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request,
    { params }
) {
    try {
        const user = await getCurrentUser()

        if (
            !['Admin', 'Manager'].includes(
                user.permission_role
            )
        ) {
            return NextResponse.json(
                { message: 'Forbidden' },
                { status: 403 }
            )
        }

        const { id } = await params

        await db.execute(
            `
                UPDATE project
                SET deleted_at = NOW()
                WHERE project_id = ?
            `,
            [id]
        )

        return NextResponse.json({
            message: 'Project deleted'
        })
    } catch (error) {
        console.error(error)

        return NextResponse.json(
            { message: 'Internal Server Error' },
            { status: 500 }
        )
    }
}