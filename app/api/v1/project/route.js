import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    hasAnyPermission,
    requirePermission,
} from '@/app/lib/permission'
import { writeAuditLog } from '@/app/lib/auditLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedProjectStatus = [
    'planning',
    'active',
    'completed',
    'cancelled',
]

export async function GET(request) {
    try {
        const auth = await requirePermission(
            request,
            'project.view'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const canViewAllProjects = await hasAnyPermission(
            user.id,
            [
                'project.create',
                'project.update',
                'project.delete',
            ]
        )

        let sql = ''
        let params = []

        if (canViewAllProjects) {
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
                INNER JOIN \`user\` u
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
                INNER JOIN \`user\` u
                    ON p.created_by = u.id
                INNER JOIN project_member pm
                    ON p.project_id = pm.project_id
                WHERE p.deleted_at IS NULL
                AND pm.user_id = ?
                ORDER BY p.project_id DESC
            `

            params = [user.id]
        }

        const [projects] = await db.execute(sql, params)

        return NextResponse.json({
            success: true,
            message: 'ok',
            projects,
            permission: {
                can_view_all: canViewAllProjects,
            },
        })
    } catch (error) {
        console.error('Project GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดโปรเจกต์ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}

export async function POST(request) {
    let connection

    try {
        const auth = await requirePermission(
            request,
            'project.create'
        )

        if (auth.response) return auth.response

        const user = auth.user

        const body = await request.json().catch(() => null)

        if (!body) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'รูปแบบข้อมูลไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const {
            project_name,
            project_code,
            description,
            start_date,
            end_date,
            status = 'planning',
            member_ids = [],
        } = body

        if (!project_name || !project_code) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกข้อมูลให้ครบถ้วน',
                },
                { status: 400 }
            )
        }

        if (!allowedProjectStatus.includes(status)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'สถานะโปรเจกต์ไม่ถูกต้อง',
                },
                { status: 400 }
            )
        }

        const [exists] = await db.execute(
            `
            SELECT project_id
            FROM project
            WHERE project_code = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [project_code]
        )

        if (exists.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'รหัสโปรเจกต์นี้ถูกใช้งานแล้ว',
                },
                { status: 409 }
            )
        }

        connection = await db.getConnection()
        await connection.beginTransaction()

        const [result] = await connection.execute(
            `
            INSERT INTO project (
                project_name,
                project_code,
                description,
                start_date,
                end_date,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                project_name,
                project_code,
                description || null,
                start_date || null,
                end_date || null,
                status,
                user.id,
            ]
        )

        const projectId = result.insertId

        const cleanMemberIds = Array.isArray(member_ids)
            ? member_ids
                  .map((item) => String(item).trim())
                  .filter(Boolean)
            : []

        const memberSet = new Set([
            user.id,
            ...cleanMemberIds,
        ])

        const values = [...memberSet].map((userId) => [
            projectId,
            userId,
        ])

        if (values.length > 0) {
            await connection.query(
                `
                INSERT IGNORE INTO project_member (
                    project_id,
                    user_id
                )
                VALUES ?
                `,
                [values]
            )
        }

        await writeAuditLog({
            connection,
            actorId: user.id,
            action: 'project.create',
            entityType: 'project',
            entityId: projectId,
            summary: `Create project ${project_name}`,
            metadata: {
                project_code,
                status,
                member_ids: [...memberSet],
            },
        })

        await connection.commit()

        return NextResponse.json(
            {
                success: true,
                project_id: projectId,
                message: 'สร้างโปรเจกต์สำเร็จ',
            },
            { status: 201 }
        )
    } catch (error) {
        if (connection) {
        await connection.rollback()
        }

        console.error('Project POST Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'สร้างโปรเจกต์ไม่สำเร็จ',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    } finally {
        if (connection) {
            connection.release()
        }
    }
}
