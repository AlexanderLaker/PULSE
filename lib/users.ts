import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { hashPassword } from './auth';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

const DATA_DIR = join(process.cwd(), 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

/**
 * Ensure data directory and file exist
 */
function ensureDataFile(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(USERS_FILE)) {
    writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Get all users from the JSON file
 */
export function getUsers(): User[] {
  try {
    ensureDataFile();
    const data = readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Get a user by email
 */
export function getUserByEmail(email: string): User | null {
  const users = getUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Create a new user
 */
export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<User> {
  const users = getUsers();

  // Check if user already exists
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('User already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create new user
  const newUser: User = {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  // Add to users list
  users.push(newUser);

  // Write back to file
  ensureDataFile();
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  return newUser;
}

/**
 * Initialize with default admin user if no users exist
 */
export async function initializeDefaultUser(): Promise<void> {
  const users = getUsers();

  if (users.length === 0) {
    const adminEmail = 'laker.alexander@gmail.com';
    const adminName = 'Alex';
    const adminPassword = 'pulse2026';

    const admin: User = {
      id: randomUUID(),
      email: adminEmail,
      name: adminName,
      passwordHash: await hashPassword(adminPassword),
      createdAt: new Date().toISOString(),
    };

    ensureDataFile();
    writeFileSync(USERS_FILE, JSON.stringify([admin], null, 2));
  }
}
