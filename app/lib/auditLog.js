import { db } from '@/app/lib/db'

function normalizeMetadata(metadata) {
    if (metadata === undefined) return null

    try {
        return JSON.stringify(metadata)
    } catch {
        return JSON.stringify({
            serialization_error: true,
        })
    }
}

export async function writeAuditLog({
    connection = db,
    actorId = null,
    action,
    entityType,
    entityId = null,
    summary = null,
    metadata = null,
    strict = false,
}) {
    if (!action || !entityType) {
        if (strict) {
            throw new Error('Audit log requires action and entityType')
        }

        return false
    }

    try {
        await connection.execute(
            `
            INSERT INTO audit_log (
                actor_id,
                action,
                entity_type,
                entity_id,
                summary,
                metadata
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                actorId,
                action,
                entityType,
                entityId === null || entityId === undefined
                    ? null
                    : String(entityId),
                summary,
                normalizeMetadata(metadata),
            ]
        )

        return true
    } catch (error) {
        if (strict) {
            throw error
        }

        console.warn('Audit log skipped:', error.message)
        return false
    }
}
