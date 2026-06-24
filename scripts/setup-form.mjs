import 'dotenv/config'
import mysql from 'mysql2/promise'

function createPool() {
    return mysql.createPool({
        host:
            process.env.MYSQL_ONLINE === 'true'
                ? process.env.MYSQL_HOST
                : process.env.MYSQL_HOST_LOCAL,
        port:
            process.env.MYSQL_ONLINE === 'true'
                ? Number(process.env.MYSQL_PORT)
                : 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
    })
}

async function columnExists(pool, tableName, columnName) {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        `,
        [tableName, columnName]
    )

    return Number(rows[0]?.total || 0) > 0
}

async function getColumnType(pool, tableName, columnName) {
    const [rows] = await pool.execute(
        `
        SELECT COLUMN_TYPE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
        LIMIT 1
        `,
        [tableName, columnName]
    )

    return rows[0]?.COLUMN_TYPE
        ? String(rows[0].COLUMN_TYPE).toUpperCase()
        : null
}

async function requireColumnType(pool, tableName, columnName) {
    const columnType = await getColumnType(pool, tableName, columnName)

    if (!columnType) {
        throw new Error(`${tableName}.${columnName} was not found`)
    }

    return columnType
}

async function indexExists(pool, tableName, indexName) {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
        `,
        [tableName, indexName]
    )

    return Number(rows[0]?.total || 0) > 0
}

async function constraintExists(pool, tableName, constraintName) {
    const [rows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND CONSTRAINT_NAME = ?
        `,
        [tableName, constraintName]
    )

    return Number(rows[0]?.total || 0) > 0
}

async function addColumnIfMissing(pool, tableName, columnName, definition) {
    if (await columnExists(pool, tableName, columnName)) {
        return false
    }

    await pool.execute(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`
    )

    return true
}

async function addIndexIfMissing(pool, tableName, indexName, definition) {
    if (await indexExists(pool, tableName, indexName)) {
        return false
    }

    await pool.execute(
        `ALTER TABLE ${tableName} ADD ${definition}`
    )

    return true
}

async function addConstraintIfMissing(pool, tableName, constraintName, definition) {
    if (await constraintExists(pool, tableName, constraintName)) {
        return false
    }

    await pool.execute(
        `ALTER TABLE ${tableName} ADD CONSTRAINT ${constraintName} ${definition}`
    )

    return true
}

async function main() {
    const pool = createPool()

    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS form_template (
                form_template_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                form_name VARCHAR(255) NOT NULL,
                form_code VARCHAR(80) NOT NULL,
                description TEXT NULL,
                paper_size VARCHAR(20) NOT NULL DEFAULT 'A4',
                orientation ENUM('portrait', 'landscape') NOT NULL DEFAULT 'portrait',
                layout_json JSON NOT NULL,
                version INT NOT NULL DEFAULT 1,
                status ENUM('draft', 'active', 'inactive') NOT NULL DEFAULT 'draft',
                created_by VARCHAR(50) NULL,
                updated_by VARCHAR(50) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (form_template_id),
                UNIQUE KEY uniq_form_template_code_active (form_code, deleted_at),
                KEY idx_form_template_status_created (status, created_at),
                KEY idx_form_template_created_by (created_by),
                KEY idx_form_template_updated_by (updated_by),
                CONSTRAINT fk_form_template_created_by
                    FOREIGN KEY (created_by)
                    REFERENCES \`user\` (id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL,
                CONSTRAINT fk_form_template_updated_by
                    FOREIGN KEY (updated_by)
                    REFERENCES \`user\` (id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            )
        `)

        const formTemplateIdColumnType = await requireColumnType(
            pool,
            'form_template',
            'form_template_id'
        )

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS form_submission (
                form_submission_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                form_template_id ${formTemplateIdColumnType} NOT NULL,
                submission_no VARCHAR(120) NOT NULL,
                data_json JSON NOT NULL,
                template_version INT NOT NULL DEFAULT 1,
                form_name_snapshot VARCHAR(255) NULL,
                form_code_snapshot VARCHAR(80) NULL,
                description_snapshot TEXT NULL,
                layout_snapshot_json JSON NULL,
                status ENUM('submitted', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'submitted',
                submitted_by VARCHAR(50) NULL,
                submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                decided_by VARCHAR(50) NULL,
                decided_at TIMESTAMP NULL DEFAULT NULL,
                decision_comment TEXT NULL,
                deleted_at TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (form_submission_id),
                UNIQUE KEY uniq_form_submission_no (submission_no),
                KEY idx_form_submission_template_created (form_template_id, submitted_at),
                KEY idx_form_submission_status_created (status, submitted_at),
                KEY idx_form_submission_submitted_by (submitted_by),
                KEY idx_form_submission_decided_by (decided_by),
                CONSTRAINT fk_form_submission_template
                    FOREIGN KEY (form_template_id)
                    REFERENCES form_template (form_template_id)
                    ON UPDATE CASCADE
                    ON DELETE RESTRICT,
                CONSTRAINT fk_form_submission_submitted_by
                    FOREIGN KEY (submitted_by)
                    REFERENCES \`user\` (id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL,
                CONSTRAINT fk_form_submission_decided_by
                    FOREIGN KEY (decided_by)
                    REFERENCES \`user\` (id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            )
        `)

        const formSubmissionIdColumnType = await requireColumnType(
            pool,
            'form_submission',
            'form_submission_id'
        )

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS form_submission_history (
                history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                form_submission_id ${formSubmissionIdColumnType} NOT NULL,
                from_status VARCHAR(30) NULL,
                to_status VARCHAR(30) NOT NULL,
                action VARCHAR(50) NOT NULL,
                comment TEXT NULL,
                changed_by VARCHAR(50) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (history_id)
            )
        `)

        if (!await constraintExists(
            pool,
            'form_submission_history',
            'fk_form_submission_history_submission'
        )) {
            await pool.execute(`
                ALTER TABLE form_submission_history
                MODIFY COLUMN form_submission_id ${formSubmissionIdColumnType} NOT NULL
            `)
        }

        await addIndexIfMissing(
            pool,
            'form_submission_history',
            'idx_form_submission_history_submission_created',
            'KEY idx_form_submission_history_submission_created (form_submission_id, created_at)'
        )

        await addIndexIfMissing(
            pool,
            'form_submission_history',
            'idx_form_submission_history_changed_by',
            'KEY idx_form_submission_history_changed_by (changed_by)'
        )

        await addConstraintIfMissing(
            pool,
            'form_submission_history',
            'fk_form_submission_history_submission',
            'FOREIGN KEY (form_submission_id) REFERENCES form_submission (form_submission_id) ON UPDATE CASCADE ON DELETE CASCADE'
        )

        await addConstraintIfMissing(
            pool,
            'form_submission_history',
            'fk_form_submission_history_changed_by',
            'FOREIGN KEY (changed_by) REFERENCES `user` (id) ON UPDATE CASCADE ON DELETE SET NULL'
        )

        await addColumnIfMissing(
            pool,
            'form_template',
            'version',
            'INT NOT NULL DEFAULT 1 AFTER layout_json'
        )

        await addColumnIfMissing(
            pool,
            'form_submission',
            'template_version',
            'INT NOT NULL DEFAULT 1 AFTER data_json'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'form_name_snapshot',
            'VARCHAR(255) NULL AFTER template_version'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'form_code_snapshot',
            'VARCHAR(80) NULL AFTER form_name_snapshot'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'description_snapshot',
            'TEXT NULL AFTER form_code_snapshot'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'layout_snapshot_json',
            'JSON NULL AFTER description_snapshot'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'decided_by',
            'VARCHAR(50) NULL AFTER submitted_at'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'decided_at',
            'TIMESTAMP NULL DEFAULT NULL AFTER decided_by'
        )
        await addColumnIfMissing(
            pool,
            'form_submission',
            'decision_comment',
            'TEXT NULL AFTER decided_at'
        )

        await pool.execute(`
            ALTER TABLE form_submission
            MODIFY COLUMN status
            ENUM('submitted', 'approved', 'rejected', 'cancelled')
            NOT NULL DEFAULT 'submitted'
        `)

        await addIndexIfMissing(
            pool,
            'form_submission',
            'idx_form_submission_decided_by',
            'KEY idx_form_submission_decided_by (decided_by)'
        )

        await addConstraintIfMissing(
            pool,
            'form_submission',
            'fk_form_submission_decided_by',
            'FOREIGN KEY (decided_by) REFERENCES `user` (id) ON UPDATE CASCADE ON DELETE SET NULL'
        )

        console.log('form tables are ready')
    } finally {
        await pool.end()
    }
}

main().catch((error) => {
    console.error('Setup form tables failed:', error)
    process.exitCode = 1
})
