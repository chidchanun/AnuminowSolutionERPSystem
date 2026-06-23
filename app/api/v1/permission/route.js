import { NextResponse } from 'next/server'
import { getAuthUserWithPermissions } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request) {
    try {
        const user = await getAuthUserWithPermissions(request)

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

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                permission_role_id: user.permission_role_id,
                permission_role_name: user.permission_role_name,
            },
            permissions: user.permissions,
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