import { db } from '@/app/lib/db'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'


export async function POST(request) {
    try {
        const body = await request.json()
        const { id, password } = body

        if (!id || !password) {
            return NextResponse.json({ status: 401, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน" })
        }

        // ดึงข้อมูลผู้ใช้จากฐานข้อมูล
        const [userRows] = await db.query(`
            SELECT 
                u.id, u.password_hash, u.department_id, u.role_id, u.picture_path,
                d.department_name,
                r.role_name,
                up.permission_role_name
            FROM user u
            LEFT JOIN user_permission_role up ON u.permission_role_id = up.permission_role_id
            LEFT JOIN department d ON u.department_id = d.department_id
            LEFT JOIN role r ON u.role_id = r.role_id
            WHERE u.id = ?
        `, [id])
        const userData = userRows[0]

        if (!userData) {
            return NextResponse.json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }

        // ตรวจสอบรหัสผ่าน
        const isPasswordValid = await bcrypt.compare(password, userData.password_hash)

        if (!isPasswordValid) {
            return NextResponse.json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
        }


        const accessToken = jwt.sign(
            {
                id: userData.id,
                department_name: userData.department_name,
                role_id: userData.role_name,
                picture_path: userData.picture_path,
                permission_role: userData.permission_role_name
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        )

        const refreshToken = jwt.sign(
            {
                id: userData.id,
                department_name: userData.department_name,
                role_id: userData.role_name,
                picture_path: userData.picture_path,
                permission_role: userData.permission_role_name
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        )

        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || request.ip || 'Unknown'
        const userAgent = request.headers.get('user-agent') || 'Unknown'

        // บันทึกหรืออัปเดต refresh token ลงฐานข้อมูล
        await db.query(
            "INSERT INTO user_session (user_id, token, token_type, ip_address, user_agent, expired_at) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), ip_address = VALUES(ip_address), user_agent = VALUES(user_agent), expired_at = VALUES(expired_at), revoked_at = NULL",
            [userData.id, refreshToken, 'refresh', ip, userAgent, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
        )

        // สร้าง response และตั้ง cookies
        const response = NextResponse.json({
            message: 'เข้าสู่ระบบสำเร็จ',
            user: {
                id: userData.id,
                department_name: userData.department_name,
                role_name: userData.role_name,
                picture_path: userData.picture_path,
                permission_role: userData.permission_role_name
            }
        }, { status: 200 })


        // ตั้ง access token cookie (1 ชั่วโมง)
        response.cookies.set('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60,
            path: '/'
        })

        // ตั้ง refresh token cookie (7 วัน)
        response.cookies.set('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 1,
            path: '/'
        })

        return response

    } catch (e) {
        console.error('Error during login:', e)
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
    }
}