/**
 * lib/csp.ts: the Content Security Policy the proxy sends. The header text
 * for production and for development, with and without a Clerk host; the
 * decoder of the Clerk publishable key (a test key, a live key, and the
 * strings that are not one); the nonce; the choice of header name.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  buildContentSecurityPolicy, clerkFrontendApi, cspHeaderName, newNonce,
  NONCE_HEADER, POLICY_HEADER, REPORT_ONLY_HEADER, REQUEST_POLICY_HEADER,
} from '@/lib/csp';

const PRODUCTION = [
  "default-src 'self'",
  "script-src 'self' 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com",
  "font-src 'self'",
  "connect-src 'self' https://clerk.example.com https://clerk-telemetry.com https://*.clerk-telemetry.com",
  "frame-src 'self' https://challenges.cloudflare.com https://clerk.example.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const DEVELOPMENT = PRODUCTION
  .replace("'unsafe-inline'; style-src", "'unsafe-inline' 'unsafe-eval'; style-src")
  .replace('https://*.clerk-telemetry.com;', 'https://*.clerk-telemetry.com ws: wss:;');

describe('buildContentSecurityPolicy', () => {
  it('is the production policy, directive by directive, with the Clerk hosts', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc', clerkHost: 'clerk.example.com', development: false });
    expect(policy).toBe(PRODUCTION);
    expect(policy).toBe(
      "default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic' https: 'unsafe-inline'; "
      + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.clerk.com; font-src 'self'; "
      + "connect-src 'self' https://clerk.example.com https://clerk-telemetry.com https://*.clerk-telemetry.com; "
      + "frame-src 'self' https://challenges.cloudflare.com https://clerk.example.com; worker-src 'self' blob:; "
      + "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    );
  });

  it('adds eval and the websocket schemes for development, and nothing else', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc', clerkHost: 'clerk.example.com', development: true });
    expect(policy).toBe(DEVELOPMENT);
    expect(policy).toContain("https: 'unsafe-inline' 'unsafe-eval'; style-src");
    expect(policy).toContain('https://*.clerk-telemetry.com ws: wss:; frame-src');
  });

  it('adds no Clerk hosts without a usable key', () => {
    for (const development of [false, true]) {
      const policy = buildContentSecurityPolicy({ nonce: 'abc', clerkHost: null, development });
      expect(policy).not.toContain('clerk.example.com');
      expect(policy).toContain("connect-src 'self' https://clerk-telemetry.com https://*.clerk-telemetry.com");
      expect(policy).toContain("frame-src 'self' https://challenges.cloudflare.com;");
      expect(policy).toBe((development ? DEVELOPMENT : PRODUCTION).replace(/ https:\/\/clerk\.example\.com/g, ''));
    }
  });

  it('separates tokens by one space and directives by a semicolon and a space, without a trailing semicolon', () => {
    const policy = buildContentSecurityPolicy({ nonce: 'abc', clerkHost: 'clerk.example.com', development: true });
    expect(policy).not.toMatch(/\s\s|;\S|;$|^\s|\s$/);
    expect(policy.split('; ').map((d) => d.split(' ')[0])).toEqual([
      'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src', 'frame-src', 'worker-src',
      'object-src', 'base-uri', 'form-action', 'frame-ancestors',
    ]);
  });
});

describe('clerkFrontendApi', () => {
  it('decodes the host from a test key and from a live key, padded or not', () => {
    expect(clerkFrontendApi(`pk_test_${btoa('bright-cat-12.clerk.accounts.dev$')}`)).toBe('bright-cat-12.clerk.accounts.dev');
    expect(clerkFrontendApi(`pk_live_${btoa('clerk.example.com$')}`)).toBe('clerk.example.com');
    expect(clerkFrontendApi('pk_test_Y2xlcmsuaW5jbHVkZWQua2F0eWRpZC05Mi5sY2wuZGV2JA')).toBe('clerk.included.katydid-92.lcl.dev');
    expect(clerkFrontendApi('pk_test_Y2xlcmsuaW5jbHVkZWQua2F0eWRpZC05Mi5sY2wuZGV2JA==')).toBe('clerk.included.katydid-92.lcl.dev');
  });

  it('returns null, and never throws, for anything that is not a key', () => {
    expect(clerkFrontendApi(undefined)).toBeNull();
    expect(clerkFrontendApi('')).toBeNull();
    expect(clerkFrontendApi('pk_test_')).toBeNull();
    expect(clerkFrontendApi('pk_test_not-base64!')).toBeNull();
    expect(clerkFrontendApi('pk_test_abcde')).toBeNull();                       // base64 characters, not base64
    expect(clerkFrontendApi(`pk_test_${btoa('clerk.example.com')}`)).toBeNull();   // no trailing $
    expect(clerkFrontendApi(`pk_test_${btoa('$')}`)).toBeNull();
    expect(clerkFrontendApi(`pk_test_${btoa('localhost$')}`)).toBeNull();          // not a host with a dot
    expect(clerkFrontendApi(`pk_test_${btoa("clerk.example.com; script-src 'unsafe-eval'$")}`)).toBeNull();
    expect(clerkFrontendApi(`sk_test_${btoa('clerk.example.com$')}`)).toBeNull();
    expect(clerkFrontendApi(`pk_prod_${btoa('clerk.example.com$')}`)).toBeNull();
  });
});

describe('newNonce', () => {
  it('is 16 random bytes in base64, different every time', () => {
    const nonces = Array.from({ length: 50 }, newNonce);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(atob(nonce)).toHaveLength(16);
    }
    expect(new Set(nonces).size).toBe(50);
  });
});

describe('the documents', () => {
  it('quote the production header as the builder emits it, and the development additions', () => {
    const doc = readFileSync(path.resolve(__dirname, '..', '..', 'docs', 'ARCHITECTURE.md'), 'utf8');
    expect(doc).toContain(buildContentSecurityPolicy({ nonce: 'abc', clerkHost: 'clerk.example.com', development: false }));
    const dev = buildContentSecurityPolicy({ nonce: 'abc', clerkHost: 'clerk.example.com', development: true });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain('ws: wss:');
    expect(doc).toContain("Development adds `'unsafe-eval'` to `script-src` and `ws: wss:` to\n`connect-src`");
  });
});

describe('the header names', () => {
  it('enforce by default and report only on request', () => {
    expect(cspHeaderName(false)).toBe('Content-Security-Policy');
    expect(cspHeaderName(true)).toBe('Content-Security-Policy-Report-Only');
    expect([POLICY_HEADER, REPORT_ONLY_HEADER]).toEqual(['Content-Security-Policy', 'Content-Security-Policy-Report-Only']);
  });

  it('name the request headers Next.js reads the nonce from', () => {
    expect(REQUEST_POLICY_HEADER).toBe('content-security-policy');
    expect(NONCE_HEADER).toBe('x-nonce');
  });
});
