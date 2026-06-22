import {
    FiHome,
    FiUsers,
    FiBarChart2,
    FiSettings,
    FiFolder,
    FiCheckSquare,
    FiBell,
    FiActivity,
    FiCalendar,
    FiClock
} from 'react-icons/fi'

export const navItems = [
    {
        label: 'ภาพรวม',
        icon: FiHome,
        href: '/dashboard',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },

    {
        label: 'การแจ้งเตือน',
        icon: FiBell,
        href: '/dashboard/notification',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },

    {
        label: 'Activity Log',
        icon: FiActivity,
        href: '/dashboard/activity',
        permission: ['Admin', 'Manager', 'Team Lead'],
    },

    {
        label: 'การลา',
        icon: FiCalendar,
        href: '/dashboard/leave',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },

    {
        label: 'Attendance',
        icon: FiClock,
        href: '/dashboard/attendance',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },

    {
        label: 'พนักงาน',
        icon: FiUsers,
        href: '/dashboard/employee',
        permission: ['Admin'],
        subMenu: [
            {
                label: 'ข้อมูลพนักงาน',
                href: '/dashboard/employee',
                permission: ['Admin'],
            },
            {
                label: 'เพิ่มพนักงาน',
                href: '/dashboard/employee/new',
                permission: ['Admin'],
            },
        ],
    },

    {
        label: 'โปรเจกต์',
        icon: FiFolder,
        href: '/dashboard/project',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
        subMenu: [
            {
                label: 'รายการโปรเจกต์',
                href: '/dashboard/project',
                permission: ['Admin', 'Manager', 'Team Lead'],
            },
            {
                label: 'โปรเจกต์ของฉัน',
                href: '/dashboard/project/my-project',
                permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
            },
            {
                label: 'Gantt Chart',
                href: '/dashboard/project/gantt',
                permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
            },
            {
                label: 'สร้างโปรเจกต์',
                href: '/dashboard/project/new',
                permission: ['Admin', 'Manager'],
            },
        ],
    },

    {
        label: 'งาน',
        icon: FiCheckSquare,
        href: '/dashboard/task',
        permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
        subMenu: [
            {
                label: 'Dashboard งาน',
                href: '/dashboard/task',
                permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
            },
            {
                label: 'งานทั้งหมด',
                href: '/dashboard/task/list',
                permission: ['Admin', 'Manager', 'Team Lead'],
            },
            {
                label: 'งานของฉัน',
                href: '/dashboard/task/my-task',
                permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
            },
            {
                label: 'Kanban Board',
                href: '/dashboard/task/board',
                permission: ['Admin', 'Manager', 'Team Lead', 'Employee'],
            },
            {
                label: 'เพิ่มงาน',
                href: '/dashboard/task/new',
                permission: ['Admin', 'Manager', 'Team Lead'],
            },
        ],
    },

    {
        label: 'รายงาน',
        icon: FiBarChart2,
        href: '/dashboard/report',
        permission: ['Admin', 'Manager'],
        subMenu: [
            {
                label: 'รายงานภาพรวม',
                href: '/dashboard/report',
                permission: ['Admin', 'Manager'],
            },
        ],
    },

    {
        label: 'ตั้งค่า',
        icon: FiSettings,
        href: '/dashboard/setting',
        permission: ['Admin'],
        subMenu: [
            {
                label: 'ตั้งค่าระบบ',
                href: '/dashboard/setting',
                permission: ['Admin'],
            },
            {
                label: 'แผนก',
                href: '/dashboard/setting/department',
                permission: ['Admin'],
            },
            {
                label: 'ตำแหน่ง',
                href: '/dashboard/setting/role',
                permission: ['Admin'],
            },
            {
                label: 'สิทธิ์ผู้ใช้',
                href: '/dashboard/setting/permission',
                permission: ['Admin'],
            },
        ],
    },
]