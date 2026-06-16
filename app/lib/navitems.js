import {
    FiHome,
    FiUsers,
    FiBarChart2,
    FiSettings,
    FiFolder,
    FiCheckSquare,
    FiCalendar,
} from 'react-icons/fi'

export const navItems = [
    {
        label: 'ภาพรวม',
        icon: FiHome,
        href: '/dashboard',
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
            },
            {
                label: 'เพิ่มพนักงาน',
                href: '/dashboard/employee/new',
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
            },
            {
                label: 'รายงานโปรเจกต์',
                href: '/dashboard/report/project',
            },
            {
                label: 'รายงานงาน',
                href: '/dashboard/report/task',
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
            },
            {
                label: 'แผนก',
                href: '/dashboard/setting/department',
            },
            {
                label: 'ตำแหน่ง',
                href: '/dashboard/setting/role',
            },
            {
                label: 'สิทธิ์ผู้ใช้',
                href: '/dashboard/setting/permission',
            },
        ],
    },
]