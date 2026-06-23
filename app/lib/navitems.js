import {
    FiHome,
    FiUsers,
    FiBarChart2,
    FiFolder,
    FiCheckSquare,
    FiBell,
    FiActivity,
    FiCalendar,
    FiClock,
    FiDatabase,
    FiShield,
} from 'react-icons/fi'

export const navGroups = [
    {
        label: 'หลัก',
        items: [
            {
                label: 'ภาพรวม',
                icon: FiHome,
                href: '/dashboard',
                permissionKey: 'dashboard.view',
            },
            {
                label: 'การแจ้งเตือน',
                icon: FiBell,
                href: '/dashboard/notification',
                permissionKey: 'notification.view',
            },
        ],
    },

    {
        label: 'HR',
        items: [
            {
                label: 'พนักงาน',
                icon: FiUsers,
                href: '/dashboard/employee',
                permissionKey: 'employee.view',
                subMenu: [
                    {
                        label: 'ข้อมูลพนักงาน',
                        href: '/dashboard/employee',
                        permissionKey: 'employee.view',
                    },
                    {
                        label: 'เพิ่มพนักงาน',
                        href: '/dashboard/employee/new',
                        permissionKey: 'employee.create',
                    },
                ],
            },
            {
                label: 'การลา',
                icon: FiCalendar,
                href: '/dashboard/leave',
                permissionKey: 'leave.view',
            },
            {
                label: 'Attendance',
                icon: FiClock,
                href: '/dashboard/attendance',
                permissionKey: 'attendance.view',
            },
        ],
    },

    {
        label: 'งานและโปรเจกต์',
        items: [
            {
                label: 'โปรเจกต์',
                icon: FiFolder,
                href: '/dashboard/project',
                permissionKey: 'project.view',
                subMenu: [
                    {
                        label: 'รายการโปรเจกต์',
                        href: '/dashboard/project',
                        permissionKey: 'project.view',
                    },
                    {
                        label: 'โปรเจกต์ของฉัน',
                        href: '/dashboard/project/my-project',
                        permissionKey: 'project.view',
                    },
                    {
                        label: 'Gantt Chart',
                        href: '/dashboard/project/gantt',
                        permissionKey: 'project.view',
                    },
                    {
                        label: 'สร้างโปรเจกต์',
                        href: '/dashboard/project/new',
                        permissionKey: 'project.create',
                    },
                ],
            },
            {
                label: 'งาน',
                icon: FiCheckSquare,
                href: '/dashboard/task',
                permissionKey: 'task.view',
                subMenu: [
                    {
                        label: 'Dashboard งาน',
                        href: '/dashboard/task',
                        permissionKey: 'task.view',
                    },
                    {
                        label: 'งานทั้งหมด',
                        href: '/dashboard/task/list',
                        permissionKey: 'task.view',
                    },
                    {
                        label: 'งานของฉัน',
                        href: '/dashboard/task/my-task',
                        permissionKey: 'task.view',
                    },
                    {
                        label: 'Kanban Board',
                        href: '/dashboard/task/board',
                        permissionKey: 'task.view',
                    },
                    {
                        label: 'เพิ่มงาน',
                        href: '/dashboard/task/new',
                        permissionKey: 'task.create',
                    },
                ],
            },
        ],
    },

    {
        label: 'รายงานและตรวจสอบ',
        items: [
            {
                label: 'รายงาน',
                icon: FiBarChart2,
                href: '/dashboard/report',
                permissionKey: 'report.view',
                subMenu: [
                    {
                        label: 'รายงานภาพรวม',
                        href: '/dashboard/report',
                        permissionKey: 'report.view',
                    },
                ],
            },
            {
                label: 'Activity Log',
                icon: FiActivity,
                href: '/dashboard/activity',
                permissionKey: 'activity.view',
            },
            {
                label: 'Audit Log',
                icon: FiShield,
                href: '/dashboard/audit-log',
                permissionKey: 'audit.view',
            },
        ],
    },

    {
        label: 'ผู้ดูแลระบบ',
        items: [
            {
                label: 'Permission',
                icon: FiShield,
                href: '/dashboard/permission',
                permissionKey: 'permission.view',
            },
            {
                label: 'Master Data',
                icon: FiDatabase,
                href: '/dashboard/master-data',
                permissionKey: 'master_data.view',
            },
        ],
    },
]

export const navItems = navGroups.flatMap((group) => group.items)
