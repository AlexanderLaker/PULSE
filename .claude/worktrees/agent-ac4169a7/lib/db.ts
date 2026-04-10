import { neon } from "@neondatabase/serverless";

function getSQL() {
  return neon(process.env.DATABASE_URL!);
}

// ─── Table Setup ───

export async function ensureUsersTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS pulse_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}

// ─── User CRUD ───

export async function findUserByEmail(email: string) {
  const sql = getSQL();
  await ensureUsersTable();
  const rows = await sql`SELECT * FROM pulse_users WHERE email = ${email.toLowerCase()}`;
  return rows[0] || null;
}

export async function createUser(email: string, hashedPassword: string, name: string) {
  const sql = getSQL();
  await ensureUsersTable();
  const rows = await sql`
    INSERT INTO pulse_users (email, password, name)
    VALUES (${email.toLowerCase()}, ${hashedPassword}, ${name})
    RETURNING id, email, name, created_at
  `;
  return rows[0];
}

export async function getUserById(id: string) {
  const sql = getSQL();
  await ensureUsersTable();
  const rows = await sql`SELECT id, email, name, created_at FROM pulse_users WHERE id = ${id}::uuid`;
  return rows[0] || null;
}
