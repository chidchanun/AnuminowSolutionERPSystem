import { NextResponse } from 'next/server'
import { db } from '@/app/lib/db'
import {
    getAuthUserWithPermissions,
    hasTaskWideAccess,
} from '@/app/lib/permission'
import path from 'path'
import { unlink } from 'fs/promises'

export const runtime = 'nodejs'


async function getAuthUser(request) {
    return getAuthUserWithPermissions(request)
}

async function getAttachment(attachmentId) {
    const [rows] = await db.execute(
        `
        SELECT
            attachment_id,
            task_id,
            user_id,
            original_name,
            file_path
        FROM task_attachment
        WHERE attachment_id = ?
        AND deleted_at IS NULL
        LIMIT 1
        `,
        [attachmentId]
    )

    return rows[0] || null
}

function canDeleteAttachment(attachment, user) {
    if (!attachment || !user) {
        return false
    }

    if (hasTaskWideAccess(user)) {
        return true
    }

    return String(attachment.user_id) === String(user.id)
}

async function removePhysicalFile(filePath) {
    if (!filePath) return

    const safeRelativePath = String(filePath)
        .replace(/^\/+/, '')

    if (!safeRelativePath.startsWith('uploads/task-attachments/')) {
        return
    }

    const absolutePath = path.join(
        process.cwd(),
        'public',
        safeRelativePath
    )

    try {
        await unlink(absolutePath)
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error
        }
    }
}

export async function DELETE(request, { params }) {
    const connection = await db.getConnection()

    try {
        const { attachmentId } = await params

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

        if (
            !attachmentId ||
            !/^\d+$/.test(String(attachmentId))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Attachment ID ไม่ถูกต้อง',
                },
                {
                    status: 400,
                }
            )
        }

        const attachment =
            await getAttachment(attachmentId)

        if (!attachment) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบไฟล์แนบ',
                },
                {
                    status: 404,
                }
            )
        }

        if (!canDeleteAttachment(attachment, user)) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่มีสิทธิ์ลบไฟล์นี้',
                },
                {
                    status: 403,
                }
            )
        }

        await connection.beginTransaction()

        await connection.execute(
            `
            UPDATE task_attachment
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE attachment_id = ?
            `,
            [attachmentId]
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
            VALUES (?, 'task_attachment', 'file', 'delete', ?, NULL, ?, ?)
            `,
            [
                attachment.task_id,
                attachment.original_name,
                'ลบไฟล์แนบในงาน',
                user.id,
            ]
        )

        await connection.commit()

        await removePhysicalFile(attachment.file_path)

        return NextResponse.json({
            success: true,
            message: 'ลบไฟล์แนบสำเร็จ',
        })
    } catch (error) {
        await connection.rollback()

        console.error('DELETE Task Attachment Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'ลบไฟล์แนบไม่สำเร็จ',
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