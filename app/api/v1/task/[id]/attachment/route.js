import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import { safeVerifyToken } from '@/app/lib/verifiedToken'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

function isAdminRole(role) {
    return ['Admin', 'Manager'].includes(role)
}

function sanitizeFileName(fileName) {
    return String(fileName || 'file')
        .replace(/[^\w.\-ก-๙]/g, '_')
        .replace(/_+/g, '_')
}

async function getAuthUser(request) {
    const token = request.cookies.get('accessToken')?.value

    if (!token) {
        return null
    }

    const payload = await safeVerifyToken(token)

    if (!payload) {
        return null
    }

    return {
        id: payload.id,
        role: payload.permission_role,
    }
}

async function canAccessTask(taskId, user) {
    if (!user?.id) {
        return false
    }

    if (isAdminRole(user.role)) {
        const [rows] = await db.execute(
            `
            SELECT task_id
            FROM task
            WHERE task_id = ?
            AND deleted_at IS NULL
            LIMIT 1
            `,
            [taskId]
        )

        return rows.length > 0
    }

    const [rows] = await db.execute(
        `
        SELECT
            t.task_id
        FROM task t
        INNER JOIN project p
            ON p.project_id = t.project_id
        LEFT JOIN project_member pm
            ON pm.project_id = p.project_id
            AND pm.user_id = ?
        LEFT JOIN task_assignment ta
            ON ta.task_id = t.task_id
            AND ta.user_id = ?
        WHERE t.task_id = ?
        AND t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
            t.created_by = ?
            OR p.created_by = ?
            OR pm.user_id IS NOT NULL
            OR ta.user_id IS NOT NULL
        )
        LIMIT 1
        `,
        [
            user.id,
            user.id,
            taskId,
            user.id,
            user.id,
        ]
    )

    return rows.length > 0
}

export async function GET(request, { params }) {
    try {
        const { id } = await params
        const taskId = id

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        if (!taskId || !/^\d+$/.test(String(taskId))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Task ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const hasAccess = await canAccessTask(taskId, user)

        if (!hasAccess) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์เข้าถึงไฟล์แนบของงานนี้',
                },
                {
                    status: 403,
                }
            )
        }

        const [attachments] = await db.execute(
            `
            SELECT
                ta.attachment_id,
                ta.task_id,
                ta.user_id,
                ta.original_name,
                ta.stored_name,
                ta.file_path,
                ta.mime_type,
                ta.file_size,
                ta.created_at,

                CONCAT(u.first_name_th, ' ', u.last_name_th) AS uploaded_by_name,
                u.picture_path AS uploaded_by_picture
            FROM task_attachment ta
            INNER JOIN user u
                ON u.id = ta.user_id
            WHERE ta.task_id = ?
            AND ta.deleted_at IS NULL
            ORDER BY ta.created_at DESC
            `,
            [taskId]
        )

        return NextResponse.json({
            success: true,
            attachments,
            current_user_id: user.id,
            current_user_role: user.role,
        })
    } catch (error) {
        console.error('GET Task Attachment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลดไฟล์แนบไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    }
}

export async function POST(request, { params }) {
    const connection = await db.getConnection()

    try {
        const { id } = await params
        const taskId = id

        const user = await getAuthUser(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                },
                {
                    status: 401,
                }
            )
        }

        if (!taskId || !/^\d+$/.test(String(taskId))) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Task ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const hasAccess = await canAccessTask(taskId, user)

        if (!hasAccess) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์แนบไฟล์ในงานนี้',
                },
                {
                    status: 403,
                }
            )
        }

        const formData = await request.formData()
        const file = formData.get('file')

        if (!file || typeof file === 'string') {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณาเลือกไฟล์',
                },
                {
                    status: 400,
                }
            )
        }

        if (file.size <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไฟล์ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไฟล์ต้องมีขนาดไม่เกิน 10MB',
                },
                {
                    status: 400,
                }
            )
        }

        if (!allowedMimeTypes.includes(file.type)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ประเภทไฟล์นี้ไม่รองรับ',
                },
                {
                    status: 400,
                }
            )
        }

        const originalName = sanitizeFileName(file.name)
        const extension = path.extname(originalName)
        const storedName = `${Date.now()}-${crypto.randomUUID()}${extension}`

        const uploadDir = path.join(
            process.cwd(),
            'public',
            'uploads',
            'task-attachments',
            String(taskId)
        )

        await mkdir(uploadDir, {
            recursive: true,
        })

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const absoluteFilePath = path.join(
            uploadDir,
            storedName
        )

        await writeFile(
            absoluteFilePath,
            buffer
        )

        const publicPath =
            `/uploads/task-attachments/${taskId}/${storedName}`

        await connection.beginTransaction()

        const [result] = await connection.execute(
            `
            INSERT INTO task_attachment (
                task_id,
                user_id,
                original_name,
                stored_name,
                file_path,
                mime_type,
                file_size
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                taskId,
                user.id,
                originalName,
                storedName,
                publicPath,
                file.type,
                file.size,
            ]
        )

        await connection.execute(
            `
            INSERT INTO task_history (
                task_id,
                target_table,
                target_column,
                action_type,
                old_value,
                new_value,
                description,
                action_by
            )
            VALUES (?, 'task_attachment', 'file', 'update', NULL, ?, ?, ?)
            `,
            [
                taskId,
                originalName,
                'แนบไฟล์ในงาน',
                user.id,
            ]
        )

        await connection.commit()

        return NextResponse.json({
            success: true,
            message: 'แนบไฟล์สำเร็จ',
            attachment_id: result.insertId,
        })
    } catch (error) {
        await connection.rollback()

        console.error('POST Task Attachment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'แนบไฟล์ไม่สำเร็จ',
                error_detail: error.message,
            },
            {
                status: 500,
            }
        )
    } finally {
        connection.release()
    }
}