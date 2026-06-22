export async function emitNotificationToUsers(userIds = []) {
    const uniqueUserIds = [
        ...new Set(
            userIds
                .filter(Boolean)
                .map((id) => String(id))
        ),
    ]

    if (uniqueUserIds.length === 0) {
        return
    }

    if (
        !process.env.SOCKET_INTERNAL_URL ||
        !process.env.SOCKET_SERVER_SECRET
    ) {
        return
    }

    try {
        await fetch(
            `${process.env.SOCKET_INTERNAL_URL}/emit/notification`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-socket-secret':
                        process.env.SOCKET_SERVER_SECRET,
                },
                body: JSON.stringify({
                    userIds: uniqueUserIds,
                    event: 'notification:new',
                    payload: {
                        refresh: true,
                    },
                }),
                cache: 'no-store',
            }
        )
    } catch (error) {
        console.error('Emit socket notification error:', error)
    }
}