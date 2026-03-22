#!/usr/bin/env node
/**
 * Crea el primer usuario administrativo (administrador).
 * Ejecutar: node scripts/create-admin.js <email> <password>
 *
 * Requiere que la migración de usuarios esté aplicada y JWT_SECRET en .env
 */

const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USERNAME || 'postgres',
  password: String(process.env.DB_PASSWORD ?? ''),
  database: process.env.DB_NAME || 'postgres',
};

async function createAdmin(email, password) {
  const passwordHash = await bcrypt.hash(password, 10);

  const client = new Client(config);

  try {
    await client.connect();

    const result = await client.query(
      `INSERT INTO usuarios_administrativos (email, password_hash, rol, is_superuser)
       VALUES ($1, $2, 'administrador', true)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         rol = EXCLUDED.rol,
         is_superuser = EXCLUDED.is_superuser
       RETURNING id, email, rol`,
      [email.toLowerCase(), passwordHash],
    );

    console.log('Usuario administrador creado/actualizado:');
    console.log('  ID:', result.rows[0].id);
    console.log('  Email:', result.rows[0].email);
    console.log('  Rol:', result.rows[0].rol);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Uso: node scripts/create-admin.js <email> <password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres');
  process.exit(1);
}

createAdmin(email, password);
