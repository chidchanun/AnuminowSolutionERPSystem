import { db } from "@/app/lib/db"
import { useUser } from "@/app/context/UserContext"
import { cookies } from 'next/headers'
import { safeVerifyToken } from '@/app/lib/verifiedToken'
import Link from "next/link"
import Image from "next/image"

function formatDate(date) {
    if (!date) return '-'

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(new Date(date))
}

async function getProjcets({ id }) {
    const [projects] = await db.execute(
        `
                SELECT
                    p.*,
                    CONCAT(
                        u.first_name_th,
                        ' ',
                        u.last_name_th
                    ) AS created_name
                FROM project p
                INNER JOIN user u
                    ON p.created_by = u.id
                WHERE p.project_id = ?
                AND p.deleted_at IS NULL
                `,
        [id]
    )

    if (projects.length === 0) {
        return NextResponse.json(
            { message: 'Project not found' },
            { status: 404 }
        )
    }

    const [members] = await db.execute(
        `
                SELECT
                    u.id,
                    CONCAT(
                        u.first_name_th,
                        ' ',
                        u.last_name_th
                    ) AS full_name,
                    r.role_name,
                    u.picture_path
                FROM project_member pm
                INNER JOIN user u
                    ON pm.user_id = u.id
                INNER JOIN role r
                    ON u.role_id = r.role_id
                WHERE pm.project_id = ?
                `,
        [id]
    )

    return {
        project: projects[0],
        members
    }
}

export default async function DetailProjectPage({ params }) {

    const { id } = await params
    const dataProject = await getProjcets({ id })
    const project = dataProject.project
    const member = dataProject.members

    const cookieStore = await cookies()

    const token =
        cookieStore.get('accessToken')?.value

    const user = token
        ? safeVerifyToken(token)
        : null

    const STATUS_COLORS = {
        active: 'bg-green-100 text-green-700',
        planning: 'bg-blue-100 text-blue-700',
        completed: 'bg-slate-100 text-slate-700',
        cancelled: 'bg-red-100 text-red-700',
    }

    const STATUS_TEXT = {
        active: 'กำลังดำเนินการ',
        planning: 'วางแผน',
        completed: 'เสร็จสิ้น',
        cancelled: 'ยกเลิก',
    }


    return (
        <div className="flex flex-col gap-6 py-6">

            {/* Header */}

            <div className="flex items-center justify-between">

                <div>
                    <h1 className="text-3xl font-bold">
                        {project.project_name}
                    </h1>

                    <p className="text-slate-500 mt-1">
                        {project.project_code}
                    </p>
                </div>

                <div className="flex gap-2">

                    <Link
                        href="/dashboard/project"
                        className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100"
                    >
                        กลับ
                    </Link>
                    {['Admin', 'Manager'].includes(user?.permission_role) && (
                        <Link
                            href={`/dashboard/project/${project.project_id}/edit`}
                            className="px-4 py-2 rounded-xl bg-sky-500 text-white hover:bg-sky-600"
                        >
                            แก้ไข
                        </Link>
                    )}


                </div>

            </div>

            {/* Summary */}

            <div className="grid gap-4 md:grid-cols-4">

                <StatCard
                    title="สมาชิก"
                    value={member.length}
                />

                <StatCard
                    title="วันเริ่ม"
                    value={formatDate(project.start_date)}
                />

                <StatCard
                    title="วันสิ้นสุด"
                    value={formatDate(project.end_date)}
                />

                <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        สถานะ
                    </p>

                    <div className="mt-5">
                        <span
                            className={`px-3 py-1 rounded-full font-medium text-lg max-lg:text-[14px] ${STATUS_COLORS[project.status]}`}
                        >
                            {STATUS_TEXT[project.status]}
                        </span>
                    </div>

                </article>

            </div>

            {/* Project Info */}

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                <h2 className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                    รายละเอียดโปรเจกต์
                </h2>

                <div className="grid gap-6 md:grid-cols-2">

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ชื่อโปรเจกต์
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.project_name}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            รหัสโปรเจกต์
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.project_code}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            ผู้สร้าง
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {project.created_name}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            วันที่สร้าง
                        </p>

                        <p className="mt-1 font-medium text-black dark:text-white">
                            {formatDate(project.created_at)}
                        </p>
                    </div>

                </div>

                <div className="mt-6">

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        รายละเอียด
                    </p>

                    <div className="mt-2 rounded-xl  text-black dark:text-white">
                        <div
                            className="
                                mt-2
                                rounded-xl
                                text-black
                                dark:text-white

                                [&_ul]:list-disc
                                [&_ul]:pl-6

                                [&_ol]:list-decimal
                                [&_ol]:pl-6

                                [&_li]:my-1
                            "
                            dangerouslySetInnerHTML={{
                                __html: project.description || '-'
                            }}
                        />
                    </div>

                </div>

            </div>

            {/* Members */}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

                <div className="flex items-center justify-between mb-4">

                    <h2 className="text-lg font-semibold text-black dark:text-white">
                        สมาชิกในโปรเจกต์
                    </h2>

                    <span className="text-sm text-slate-500 dark:text-slate-400">
                        {member.length} คน
                    </span>

                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

                    {member.map((member) => (
                        <div
                            key={member.id}
                            className="rounded-xl border border-slate-200 p-4"
                        >

                            <div className="flex items-center gap-3">

                                <div className="h-12 w-12 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-semibold">
                                    {/* {member.full_name?.charAt(0)} */}
                                    {member.picture_path ?
                                        <Image
                                            src={member.picture_path}
                                            alt="User Profile"
                                            width={48}
                                            height={48}
                                            sizes="48px"
                                            className='rounded-full'
                                        /> :
                                        member.full_name?.charAt(0)
                                    }
                                </div>

                                <div>
                                    <p className="font-medium text-black dark:text-white">
                                        {member.full_name}
                                    </p>

                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        {member.role_name}
                                    </p>
                                </div>

                            </div>

                        </div>
                    ))}
                </div>

            </div>

        </div>
    )
}

function StatCard({
    title,
    value,
}) {
    return (
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm transition-colors">

            <p className="text-sm text-slate-500 dark:text-slate-400">
                {title}
            </p>

            <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100 max-md:text-lg">
                {value}
            </p>

        </article>
    )
}