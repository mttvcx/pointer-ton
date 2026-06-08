import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

/**
 * Proves sandbox mode is OFF unless explicitly enabled. Re-imports the module
 * fresh per scenario so env/localStorage are read at evaluation time.
 */

const ENV_KEY = 'NEXT_PUBLIC_POINTER_SANDBOX_MODE';

function clearEnvAndWindow() {
  delete process.env[ENV_KEY];
  delete (globalThis as { window?: unknown }).window;
}

afterEach(clearEnvAndWindow);

async function freshMode() {
  // Cache-bust the module so top-level reads re-evaluate.
  const mod = await import(`@/lib/sandbox/mode?cachebust=${Math.random()}`);
  return mod as typeof import('@/lib/sandbox/mode');
}

describe('sandbox mode activation', () => {
  it('is OFF by default (no env, no localStorage)', async () => {
    clearEnvAndWindow();
    const { isSandboxMode } = await freshMode();
    assert.equal(isSandboxMode(), false);
  });

  it('is ON when env flag = 1', async () => {
    clearEnvAndWindow();
    process.env[ENV_KEY] = '1';
    const { isSandboxMode, isSandboxForcedByEnv } = await freshMode();
    assert.equal(isSandboxMode(), true);
    assert.equal(isSandboxForcedByEnv(), true);
  });

  it('is OFF when env flag is some other value', async () => {
    clearEnvAndWindow();
    process.env[ENV_KEY] = '0';
    const { isSandboxMode } = await freshMode();
    assert.equal(isSandboxMode(), false);
  });

  it('is ON when localStorage flag = 1', async () => {
    clearEnvAndWindow();
    const store = new Map<string, string>([['pointer-sandbox-mode', '1']]);
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
    const { isSandboxMode, isSandboxForcedByEnv } = await freshMode();
    assert.equal(isSandboxMode(), true);
    // localStorage opt-in is NOT env-forced.
    assert.equal(isSandboxForcedByEnv(), false);
  });
});
