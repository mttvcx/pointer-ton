import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasPermission,
  unionPermissions,
  ADMIN_WILDCARD,
  ADMIN_PERMISSIONS,
} from '@/lib/admin/permissions';

describe('admin RBAC — permission resolution', () => {
  it('wildcard grants every permission', () => {
    for (const perm of ADMIN_PERMISSIONS) {
      assert.equal(hasPermission([ADMIN_WILDCARD], perm), true);
    }
  });

  it('exact permission match grants only that permission', () => {
    assert.equal(hasPermission(['users.read'], 'users.read'), true);
    assert.equal(hasPermission(['users.read'], 'users.write'), false);
  });

  it('empty permission set denies everything', () => {
    assert.equal(hasPermission([], 'audit.read'), false);
  });

  it('unionPermissions dedupes across roles', () => {
    const union = unionPermissions([
      ['users.read', 'packs.read'],
      ['packs.read', 'audit.read'],
    ]);
    assert.equal(union.length, 3);
    assert.ok(union.includes('users.read'));
    assert.ok(union.includes('packs.read'));
    assert.ok(union.includes('audit.read'));
  });

  it('union with wildcard resolves any permission', () => {
    const union = unionPermissions([['users.read'], [ADMIN_WILDCARD]]);
    assert.equal(hasPermission(union, 'championship.finalize'), true);
  });
});
