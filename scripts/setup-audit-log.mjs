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

async function main() {
    const pool = createPool()

    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS audit_log (
                audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                actor_id VARCHAR(64) NULL,
                action VARCHAR(80) NOT NULL,
                entity_type VARCHAR(80) NOT NULL,
                entity_id VARCHAR(120) NULL,
                summary VARCHAR(500) NULL,
                metadata JSON NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (audit_id),
                INDEX idx_audit_actor_created (actor_id, created_at),
                INDEX idx_audit_entity_created (
                    entity_type,
                    entity_id,
                    created_at
                ),
                INDEX idx_audit_action_created (action, created_at),
                CONSTRAINT fk_audit_log_actor
                    FOREIGN KEY (actor_id)
                    REFERENCES \`user\` (id)
                    ON UPDATE CASCADE
                    ON DELETE SET NULL
            )
        `)

        console.log('audit_log table is ready')
    } finally {
        await pool.end()
    }
}

main().catch((error) => {
    console.error('Setup audit log failed:', error)
    process.exitCode = 1
})
