import { db } from '@/app/lib/db'

export async function createNotification({
    connection = db,
    userId,
    type,
    title,
    message = null,
    link = null,
    sourceTable = null,
    sourceId = null,
    uniqueKey = null,
    createdBy = null,
}) {
    if (!userId || !type || !title) {
        return null
    }

    const sql = uniqueKey
        ? `
        INSERT IGNORE INTO notification (
            user_id,
            type,
            title,
            message,
            link,
            source_table,
            source_id,
            unique_key,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        : `
        INSERT INTO notification (
            user_id,
            type,
            title,
            message,
            link,
            source_table,
            source_id,
            unique_key,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `

    const [result] = await connection.execute(
        sql,
        [
            userId,
            type,
            title,
            message,
            link,
            sourceTable,
            sourceId,
            uniqueKey,
            createdBy,
        ]
    )

    return result
}

export async function createNotifications({
    connection = db,
    userIds = [],
    type,
    title,
    message = null,
    link = null,
    sourceTable = null,
    sourceId = null,
    createdBy = null,
    uniqueKeyPrefix = null,
}) {
    const uniqueUserIds = [
        ...new Set(
            userIds
                .filter(Boolean)
                .map((id) => String(id))
        ),
    ]

    for (const userId of uniqueUserIds) {
        await createNotification({
            connection,
            userId,
            type,
            title,
            message,
            link,
            sourceTable,
            sourceId,
            createdBy,
            uniqueKey: uniqueKeyPrefix
                ? `${uniqueKeyPrefix}:${userId}`
                : null,
        })
    }
}