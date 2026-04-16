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

export async function ensurePasswordResetTable() {
  const sql = getSQL();
  await sql`
    CREATE TABLE IF NOT EXISTS pulse_password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
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

export async function updateUserPassword(userId: string, hashedPassword: string) {
  const sql = getSQL();
  await ensureUsersTable();
  const rows = await sql`
    UPDATE pulse_users SET password = ${hashedPassword}
    WHERE id = ${userId}::uuid
    RETURNING id, email, name
  `;
  return rows[0] || null;
}

// ─── Password Reset Tokens ───

export async function createPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  const sql = getSQL();
  await ensurePasswordResetTable();
  // Invalidate any existing unused tokens for this user
  await sql`
    UPDATE pulse_password_resets SET used = TRUE
    WHERE user_id = ${userId}::uuid AND used = FALSE
  `;
  // Create new token
  const rows = await sql`
    INSERT INTO pulse_password_resets (user_id, token, expires_at)
    VALUES (${userId}::uuid, ${token}, ${expiresAt.toISOString()})
    RETURNING id, token, expires_at
  `;
  return rows[0];
}

export async function findValidResetToken(token: string) {
  const sql = getSQL();
  await ensurePasswordResetTable();
  const rows = await sql`
    SELECT pr.*, pu.email, pu.name
    FROM pulse_password_resets pr
    JOIN pulse_users pu ON pr.user_id = pu.id
    WHERE pr.token = ${token}
      AND pr.used = FALSE
      AND pr.expires_at > NOW()
    ORDER BY pr.created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function markResetTokenUsed(token: string) {
  const sql = getSQL();
  await sql`
    UPDATE pulse_password_resets SET used = TRUE WHERE token = ${token}
  `;
}
