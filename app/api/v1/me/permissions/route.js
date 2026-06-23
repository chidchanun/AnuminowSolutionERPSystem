import { NextResponse } from 'next/server'
import {
    getAuthUserWithRole,
    getPermissionKeysByRoleId,
} from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const user = await getAuthUserWithRole(request)

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Unauthorized',
                    permissions: [],
                },
                { status: 401 }
            )
        }

        const permissions = await getPermissionKeysByRoleId(
            user.permission_role_id
        )

        return NextResponse.json({
            success: true,
            user,
            permissions,
        })
    } catch (error) {
        console.error('Me Permissions GET Error:', error)

        return NextResponse.json(
            {
                success: false,
                message: 'โหลด Permission ไม่สำเร็จ',
                permissions: [],
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}