import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { writeAuditLog } from '@/app/lib/auditLog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getRequestMetadata(request) {
    const forwardedFor = request.headers.get('x-forwarded-for')

    return {
        ip:
            forwardedFor?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            request.ip ||
            'Unknown',
        user_agent: request.headers.get('user-agent') || 'Unknown',
    }
}

function createTokenPayload(userData) {
    return {
        id: userData.id,
        department_id: userData.department_id,
        department_name: userData.department_name,
        role_id: userData.role_id,
        role_name: userData.role_name,
        picture_path: userData.picture_path,
        permission_role: userData.permission_role_name || 'Employee',
    }
}

export async function POST(request) {
    try {
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET is missing')

            return NextResponse.json(
                {
                    success: false,
                    message: 'Server configuration error',
                },
                { status: 500 }
            )
        }

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

        const { id, password } = body
        const requestMetadata = getRequestMetadata(request)

        if (!id || !password) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน',
                },
                { status: 400 }
            )
        }

        const [userRows] = await db.query(
            `
            SELECT 
                u.id,
                u.password_hash,
                u.department_id,
                u.role_id,
                u.picture_path,
                u.status,
                u.deleted_at,

                d.department_name,
                r.role_name,
                up.permission_role_name
            FROM \`user\` u
            LEFT JOIN user_permission_role up 
                ON u.permission_role_id = up.permission_role_id
            LEFT JOIN department d 
                ON u.department_id = d.department_id
            LEFT JOIN role r 
                ON u.role_id = r.role_id
            WHERE u.id = ?
            LIMIT 1
            `,
            [id]
        )

        const userData = userRows[0]

        if (!userData) {
            await writeAuditLog({
                actorId: null,
                action: 'auth.login_failed',
                entityType: 'auth',
                entityId: id,
                summary: `Login failed for ${id}`,
                metadata: {
                    ...requestMetadata,
                    reason: 'user_not_found',
                    attempted_user_id: id,
                },
            })

            return NextResponse.json(
                {
                    success: false,
                    message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
                },
                { status: 401 }
            )
        }

        if (
            userData.deleted_at ||
            userData.status !== 'active'
        ) {
            await writeAuditLog({
                actorId: userData.id,
                action: 'auth.login_failed',
                entityType: 'auth',
                entityId: userData.id,
                summary: `Login failed for ${userData.id}`,
                metadata: {
                    ...requestMetadata,
                    reason: 'user_inactive_or_deleted',
                    attempted_user_id: userData.id,
                    status: userData.status,
                },
            })

            return NextResponse.json(
                {
                    success: false,
                    message: 'บัญชีนี้ไม่สามารถเข้าสู่ระบบได้',
                },
                { status: 403 }
            )
        }

        const isPasswordValid = await bcrypt.compare(
            password,
            userData.password_hash
        )

        if (!isPasswordValid) {
            await writeAuditLog({
                actorId: null,
                action: 'auth.login_failed',
                entityType: 'auth',
                entityId: userData.id,
                summary: `Login failed for ${userData.id}`,
                metadata: {
                    ...requestMetadata,
                    reason: 'invalid_password',
                    attempted_user_id: userData.id,
                },
            })

            return NextResponse.json(
                {
                    success: false,
                    message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
                },
                { status: 401 }
            )
        }

        const tokenPayload = createTokenPayload(userData)

        const accessToken = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        const refreshToken = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        await db.query(
            `
            INSERT INTO user_session (
                user_id,
                token,
                token_type,
                ip_address,
                user_agent,
                expired_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                token = VALUES(token),
                ip_address = VALUES(ip_address),
                user_agent = VALUES(user_agent),
                expired_at = VALUES(expired_at),
                revoked_at = NULL
            `,
            [
                userData.id,
                refreshToken,
                'refresh',
                requestMetadata.ip,
                requestMetadata.user_agent,
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ]
        )

        await writeAuditLog({
            actorId: userData.id,
            action: 'auth.login_success',
            entityType: 'auth',
            entityId: userData.id,
            summary: `${userData.id} logged in`,
            metadata: {
                ...requestMetadata,
                department_name: userData.department_name,
                role_name: userData.role_name,
                permission_role: userData.permission_role_name,
            },
        })

        const response = NextResponse.json(
            {
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                user: {
                    id: userData.id,
                    department_id: userData.department_id,
                    department_name: userData.department_name,
                    role_id: userData.role_id,
                    role_name: userData.role_name,
                    picture_path: userData.picture_path,
                    permission_role: userData.permission_role_name || 'Employee',
                },
            },
            { status: 200 }
        )

        response.cookies.set('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60,
            path: '/',
        })

        response.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        })

        return response
    } catch (e) {
        console.error('Error during login:', e)

        return NextResponse.json(
            {
                success: false,
                message: 'Internal Server Error',
                error_detail:
                    process.env.NODE_ENV === 'development'
                        ? e.message
                        : undefined,
            },
            { status: 500 }
        )
    }
}