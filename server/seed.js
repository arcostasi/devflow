import db from './db.js';
import bcrypt from 'bcryptjs';

export const seedDatabase = () => {
    console.log('Seeding database with clean slate...');

    // Clear ALL existing data
    db.exec('DELETE FROM activities');
    db.exec('DELETE FROM comments');
    db.exec('DELETE FROM subtasks');
    db.exec('DELETE FROM tasks');
    db.exec('DELETE FROM sprints');
    db.exec('DELETE FROM repositories');
    db.exec('DELETE FROM user_groups');
    db.exec('DELETE FROM groups');
    db.exec('DELETE FROM users');
    db.exec('DELETE FROM settings');

    // Create admin user with hashed password
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const insertUser = db.prepare(`
        INSERT INTO users (id, name, email, password, avatar, role, status, createdAt) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(
        'admin',
        'Administrador',
        'admin@devflow.local',
        adminPassword,
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin',
        'admin',
        'active',
        new Date().toISOString()
    );

    // Create default groups
    const insertGroup = db.prepare('INSERT INTO groups (id, name, description, permissions) VALUES (?, ?, ?, ?)');
    insertGroup.run('g-admins', 'Administradores', 'Acesso total ao sistema', JSON.stringify(['*']));
    insertGroup.run('g-devs', 'Desenvolvedores', 'Acesso a código e tarefas', JSON.stringify(['tasks:*', 'repos:read', 'git:*']));
    insertGroup.run('g-viewers', 'Visualizadores', 'Apenas leitura', JSON.stringify(['tasks:read', 'repos:read']));

    // Link admin to admins group
    db.prepare('INSERT INTO user_groups (userId, groupId) VALUES (?, ?)').run('admin', 'g-admins');

    // Default settings
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('gitDirectory', '');
    insertSetting.run('allowSelfRegister', 'true');
    insertSetting.run('requireApproval', 'true');

    console.log('Database seeded: Admin user (admin@devflow.local / admin123) created.');
    console.log('Default groups created: Administradores, Desenvolvedores, Visualizadores');
};
