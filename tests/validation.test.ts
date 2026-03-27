import { describe, it, expect } from 'vitest';
import { loginSchema, registerSchema, createTaskSchema, updateTaskSchema, updatePasswordSchema } from '../server/validation.js';

describe('Zod validation schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({ email: 'a@b.com', password: '12345678' });
      expect(result.success).toBe(true);
    });

    it('rejects missing email', () => {
      const result = loginSchema.safeParse({ password: '12345678' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email format', () => {
      const result = loginSchema.safeParse({ email: 'not-an-email', password: '12345678' });
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    it('accepts valid registration', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'john@test.com', password: 'SecureP1' });
      expect(result.success).toBe(true);
    });

    it('rejects weak password (no uppercase)', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'j@t.com', password: 'weakpass1' });
      expect(result.success).toBe(false);
    });

    it('rejects weak password (no digit)', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'j@t.com', password: 'Weakpass' });
      expect(result.success).toBe(false);
    });

    it('rejects short password', () => {
      const result = registerSchema.safeParse({ name: 'John', email: 'j@t.com', password: 'Ab1' });
      expect(result.success).toBe(false);
    });

    it('rejects short name', () => {
      const result = registerSchema.safeParse({ name: 'J', email: 'j@t.com', password: 'SecureP1' });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePasswordSchema', () => {
    it('accepts valid password update', () => {
      const result = updatePasswordSchema.safeParse({ currentPassword: 'OldPass1', newPassword: 'NewPass2' });
      expect(result.success).toBe(true);
    });

    it('rejects new password without uppercase', () => {
      const result = updatePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'newpass12' });
      expect(result.success).toBe(false);
    });
  });

  describe('createTaskSchema', () => {
    it('accepts valid task', () => {
      const result = createTaskSchema.safeParse({
        id: 't-1',
        title: 'Fix login bug',
        status: 'todo',
        priority: 'high',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = createTaskSchema.safeParse({
        id: 't-1',
        title: 'X',
        status: 'invalid_status',
        priority: 'high',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid priority', () => {
      const result = createTaskSchema.safeParse({
        id: 't-1',
        title: 'X',
        status: 'todo',
        priority: 'urgent',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing title', () => {
      const result = createTaskSchema.safeParse({
        id: 't-1',
        status: 'todo',
        priority: 'low',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateTaskSchema', () => {
    it('accepts partial update', () => {
      const result = updateTaskSchema.safeParse({ status: 'done' });
      expect(result.success).toBe(true);
    });

    it('accepts empty update (all optional)', () => {
      const result = updateTaskSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid status value', () => {
      const result = updateTaskSchema.safeParse({ status: 'unknown' });
      expect(result.success).toBe(false);
    });
  });
});
