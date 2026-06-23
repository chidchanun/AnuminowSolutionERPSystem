import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const permissionSource = await readFile(
    new URL('../app/lib/permission.js', import.meta.url),
    'utf8'
)

const mockState = {
    tokenPayload: null,
    userRows: [],
    permissionRows: [],
    queries: [],
}

function resetMockState() {
    mockState.tokenPayload = null
    mockState.userRows = []
    mockState.permissionRows = []
    mockState.queries = []
}

const mockDb = {
    async execute(sql, params = []) {
        mockState.queries.push({ sql, params })

        if (sql.includes('FROM `user` u')) {
            return [mockState.userRows]
        }

        if (sql.includes('FROM permission_role_map prm')) {
            return [mockState.permissionRows]
        }

        return [[]]
    },
}

function createRequestWithAccessToken(value = 'token') {
    return {
        cookies: {
            get(name) {
                if (name !== 'accessToken') return undefined
                return { value }
            },
        },
    }
}

async function createMockModule(identifier, exports) {
    const vmModule = new vm.SyntheticModule(
        Object.keys(exports),
        function initialize() {
            for (const [key, value] of Object.entries(exports)) {
                this.setExport(key, value)
            }
        },
        { identifier }
    )

    await vmModule.link(() => {
        throw new Error(`Unexpected nested import in ${identifier}`)
    })
    await vmModule.evaluate()

    return vmModule
}

async function loadPermissionModule() {
    const moduleCache = new Map()

    async function linker(specifier) {
        if (moduleCache.has(specifier)) {
            return moduleCache.get(specifier)
        }

        let vmModule

        if (specifier === './navitems') {
            vmModule = await createMockModule(specifier, {
                navItems: [],
            })
        } else if (specifier === 'next/server') {
            vmModule = await createMockModule(specifier, {
                NextResponse: {
                    json(body, init = {}) {
                        return {
                            body,
                            status: init.status || 200,
                        }
                    },
                },
            })
        } else if (specifier === '@/app/lib/db') {
            vmModule = await createMockModule(specifier, {
                db: mockDb,
            })
        } else if (specifier === '@/app/lib/verifiedToken') {
            vmModule = await createMockModule(specifier, {
                safeVerifyToken() {
                    return mockState.tokenPayload
                },
            })
        } else {
            throw new Error(`Unexpected import: ${specifier}`)
        }

        moduleCache.set(specifier, vmModule)
        return vmModule
    }

    const vmModule = new vm.SourceTextModule(permissionSource, {
        identifier: 'app/lib/permission.js',
    })

    await vmModule.link(linker)
    await vmModule.evaluate()

    return vmModule.namespace
}

const permission = await loadPermissionModule()

test('hasPermissionKey checks a user permission list', () => {
    const user = {
        permissions: ['project.view', 'task.update'],
    }

    assert.equal(
        permission.hasPermissionKey(user, 'project.view'),
        true
    )
    assert.equal(
        permission.hasPermissionKey(user, 'project.delete'),
        false
    )
    assert.equal(permission.hasPermissionKey(null, 'project.view'), false)
})

test('hasAnyPermissionKey allows empty requirements and any matching key', () => {
    const user = {
        permissions: ['task.view'],
    }

    assert.equal(permission.hasAnyPermissionKey(user, []), true)
    assert.equal(
        permission.hasAnyPermissionKey(user, [
            'project.view',
            'task.view',
        ]),
        true
    )
    assert.equal(
        permission.hasAnyPermissionKey(user, [
            'project.create',
            'project.delete',
        ]),
        false
    )
})

test('wide access helpers are permission based', () => {
    assert.equal(
        permission.isAdmin({
            permissions: ['permission.manage'],
        }),
        true
    )
    assert.equal(
        permission.isAdmin({
            permission_role_name: 'Admin',
            permissions: [],
        }),
        false
    )
    assert.equal(
        permission.hasProjectWideAccess({
            permissions: ['project.update'],
        }),
        true
    )
    assert.equal(
        permission.hasProjectWideAccess({
            permissions: ['project.view'],
        }),
        false
    )
    assert.equal(
        permission.hasTaskWideAccess({
            permissions: ['task.delete'],
        }),
        true
    )
    assert.equal(
        permission.hasTaskRelatedAccess({
            permissions: ['task.view'],
        }),
        false
    )
})

test('requirePermission returns 401 when there is no valid auth user', async () => {
    resetMockState()
    mockState.tokenPayload = null

    const result = await permission.requirePermission(
        createRequestWithAccessToken(),
        'project.view'
    )

    assert.equal(result.user, null)
    assert.equal(result.response.status, 401)
    assert.equal(result.response.body.success, false)
})

test('requirePermission returns 403 when the user lacks the permission', async () => {
    resetMockState()
    mockState.tokenPayload = { id: 'U001' }
    mockState.userRows = [
        {
            id: 'U001',
            permission_role_id: 2,
            permission_role_name: 'Custom',
        },
    ]
    mockState.permissionRows = [
        {
            permission_key: 'project.view',
        },
    ]

    const result = await permission.requirePermission(
        createRequestWithAccessToken(),
        'project.delete'
    )

    assert.equal(result.user.id, 'U001')
    assert.equal(result.response.status, 403)
    assert.equal(result.response.body.success, false)
})

test('requirePermission returns the hydrated user when allowed', async () => {
    resetMockState()
    mockState.tokenPayload = { id: 'U001' }
    mockState.userRows = [
        {
            id: 'U001',
            permission_role_id: 2,
            permission_role_name: 'Custom',
        },
    ]
    mockState.permissionRows = [
        {
            permission_key: 'project.view',
        },
        {
            permission_key: 'project.update',
        },
    ]

    const result = await permission.requirePermission(
        createRequestWithAccessToken(),
        'project.update'
    )

    assert.equal(result.response, null)
    assert.equal(result.user.id, 'U001')
    assert.deepEqual(result.user.permissions, [
        'project.view',
        'project.update',
    ])
})
