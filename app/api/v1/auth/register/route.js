import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import bcrypt from 'bcrypt'
import { requirePermission } from '@/app/lib/permission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
    try {
        const auth = await requirePermission(
            request,
            'employee.create'
        )

        if (auth.response) return auth.response

        const body = await request.json()

        const {
            prefix,
            first_name_th,
            last_name_th,
            first_name_en,
            last_name_en,
            phone,
            password,
            password_confirmed,
            department_id,
            role_id,
            picture_data,
            permission_role_id,
        } = body

        if (
            !prefix ||
            !first_name_th ||
            !last_name_th ||
            !first_name_en ||
            !last_name_en ||
            !phone ||
            !password ||
            !password_confirmed ||
            !department_id ||
            !role_id
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'โปรดกรอกข้อมูลให้ครบถ้วน',
                },
                { status: 400 }
            )
        }

        if (password !== password_confirmed) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'รหัสผ่านไม่ตรงกัน',
                },
                { status: 400 }
            )
        }

        const [departmentRows] = await db.query(
            `
            SELECT *
            FROM department
            WHERE department_id = ?
            LIMIT 1
            `,
            [department_id]
        )

        const departmentData = departmentRows[0]

        if (!departmentData) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบข้อมูลแผนก',
                },
                { status: 404 }
            )
        }

        const [roleRows] = await db.query(
            `
            SELECT *
            FROM role
            WHERE role_id = ?
            LIMIT 1
            `,
            [role_id]
        )

        const roleData = roleRows[0]

        if (!roleData) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบข้อมูลตำแหน่ง',
                },
                { status: 404 }
            )
        }

        const targetPermissionRoleId =
            Number(permission_role_id) || 4

        const [permissionRoleRows] = await db.query(
            `
            SELECT permission_role_id
            FROM user_permission_role
            WHERE permission_role_id = ?
            LIMIT 1
            `,
            [targetPermissionRoleId]
        )

        if (!permissionRoleRows[0]) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่พบสิทธิ์ผู้ใช้',
                },
                { status: 404 }
            )
        }

        const email =
            `${first_name_en.toLowerCase()}.${last_name_en.toLowerCase()}@gmail.com`

        const [emailRows] = await db.query(
            `
            SELECT id
            FROM \`user\`
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        )

        if (emailRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'Email นี้ถูกใช้งานแล้ว',
                },
                { status: 409 }
            )
        }

        const currentYearTh = new Date().getFullYear() + 543
        const yearTh = currentYearTh.toString().slice(-2)

        const [countRows] = await db.query(
            `
            SELECT COUNT(*) AS count
            FROM \`user\`
            WHERE department_id = ?
            `,
            [department_id]
        )

        const existingCount = countRows[0]?.count ?? 0
        const nextCount = existingCount + 1
        const userCountPadded = String(nextCount).padStart(4, '0')

        const createUserId =
            `${yearTh}${departmentData.department_code}${userCountPadded}`

        const [userIdRows] = await db.query(
            `
            SELECT id
            FROM \`user\`
            WHERE id = ?
            LIMIT 1
            `,
            [createUserId]
        )

        if (userIdRows.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: 'รหัสพนักงานซ้ำ กรุณาลองใหม่อีกครั้ง',
                },
                { status: 409 }
            )
        }

        const passwordHash = await bcrypt.hash(password, 10)

        let picture_path = null

        if (picture_data) {
            const match = picture_data.match(
                /^data:(image\/[^;]+);base64,(.+)$/
            )

            if (!match) {
                return NextResponse.json(
                    {
                        success: false,
                        message: 'ข้อมูลรูปภาพไม่ถูกต้อง',
                    },
                    { status: 400 }
                )
            }

            const mimeType = match[1]
            const base64Data = match[2]
            const extension = mimeType
                .split('/')[1]
                .replace('jpeg', 'jpg')

            const uploadDir = path.join(
                process.cwd(),
                'public',
                'uploads',
                'employees'
            )

            await fs.mkdir(uploadDir, {
                recursive: true,
            })

            const fileName = `${createUserId}.${extension}`
            const filePath = path.join(uploadDir, fileName)

            await fs.writeFile(
                filePath,
                Buffer.from(base64Data, 'base64')
            )

            picture_path = `/uploads/employees/${fileName}`
        }

        await db.query(
            `
            INSERT INTO \`user\` (
                id,
                prefix,
                first_name_th,
                last_name_th,
                first_name_en,
                last_name_en,
                email,
                phone,
                password_hash,
                department_id,
                role_id,
                picture_path,
                permission_role_id,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `,
            [
                createUserId,
                prefix,
                first_name_th,
                last_name_th,
                first_name_en,
                last_name_en,
                email,
                phone,
                passwordHash,
                department_id,
                role_id,
                picture_path,
                targetPermissionRoleId,
            ]
        )

        return NextResponse.json(
            {
                success: true,
                message: 'สร้างพนักงานสำเร็จ',
                user_id: createUserId,
            },
            { status: 201 }
        )
    } catch (e) {
        console.error('Create employee error:', e)

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