export const permissionCatalog = [
    {
        key: 'dashboard.view',
        name: 'View Dashboard',
        module: 'Dashboard',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'notification.view',
        name: 'View Notifications',
        module: 'Notification',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'employee.view',
        name: 'View Employees',
        module: 'Employee',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'employee.create',
        name: 'Create Employees',
        module: 'Employee',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'employee.update',
        name: 'Update Employees',
        module: 'Employee',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'employee.delete',
        name: 'Delete Employees',
        module: 'Employee',
        defaultRoles: ['Admin'],
    },
    {
        key: 'employee.export',
        name: 'Export Employees',
        module: 'Employee',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'leave.view',
        name: 'View Leave Requests',
        module: 'Leave',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'leave.create',
        name: 'Create Leave Requests',
        module: 'Leave',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'leave.approve',
        name: 'Approve Leave Requests',
        module: 'Leave',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'attendance.view',
        name: 'View Attendance',
        module: 'Attendance',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'attendance.manage',
        name: 'Manage Attendance',
        module: 'Attendance',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'attendance.export',
        name: 'Export Attendance',
        module: 'Attendance',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'project.view',
        name: 'View Projects',
        module: 'Project',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'project.create',
        name: 'Create Projects',
        module: 'Project',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'project.update',
        name: 'Update Projects',
        module: 'Project',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'project.delete',
        name: 'Delete Projects',
        module: 'Project',
        defaultRoles: ['Admin'],
    },
    {
        key: 'task.view',
        name: 'View Tasks',
        module: 'Task',
        defaultRoles: ['Admin', 'Manager', 'Team Lead', 'Employee'],
    },
    {
        key: 'task.create',
        name: 'Create Tasks',
        module: 'Task',
        defaultRoles: ['Admin', 'Manager', 'Team Lead'],
    },
    {
        key: 'task.update',
        name: 'Update Tasks',
        module: 'Task',
        defaultRoles: ['Admin', 'Manager', 'Team Lead'],
    },
    {
        key: 'task.delete',
        name: 'Delete Tasks',
        module: 'Task',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'report.view',
        name: 'View Reports',
        module: 'Report',
        defaultRoles: ['Admin', 'Manager'],
    },
    {
        key: 'activity.view',
        name: 'View Activity Log',
        module: 'Activity',
        defaultRoles: ['Admin', 'Manager', 'Team Lead'],
    },
    {
        key: 'activity.export',
        name: 'Export Activity Log',
        module: 'Activity',
        defaultRoles: ['Admin', 'Manager', 'Team Lead'],
    },
    {
        key: 'audit.view',
        name: 'View Audit Log',
        module: 'Audit',
        defaultRoles: ['Admin'],
    },
    {
        key: 'audit.export',
        name: 'Export Audit Log',
        module: 'Audit',
        defaultRoles: ['Admin'],
    },
    {
        key: 'permission.view',
        name: 'View Permission Matrix',
        module: 'Permission',
        defaultRoles: ['Admin'],
    },
    {
        key: 'permission.manage',
        name: 'Manage Permissions',
        module: 'Permission',
        defaultRoles: ['Admin'],
    },
]

export function getPermissionCatalogKeys() {
    return permissionCatalog.map((item) => item.key)
}
