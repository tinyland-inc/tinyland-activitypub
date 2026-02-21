/**
 * HTTP Signature tests
 */

import { describe, it, expect } from 'vitest';
import {
  generateDigest,
  verifyDigest,
  parseSignatureHeader,
  signRequest
} from '../src/services/HttpSignatureService.js';
import crypto from 'crypto';

describe('HTTP Signatures', () => {
  describe('generateDigest', () => {
    it('should generate SHA-256 digest', () => {
      const body = '{"hello":"world"}';
      const digest = generateDigest(body);
      expect(digest).toMatch(/^SHA-256=.+$/);
    });

    it('should generate consistent digests', () => {
      const body = '{"test":"data"}';
      const digest1 = generateDigest(body);
      const digest2 = generateDigest(body);
      expect(digest1).toBe(digest2);
    });

    it('should generate different digests for different bodies', () => {
      const digest1 = generateDigest('body1');
      const digest2 = generateDigest('body2');
      expect(digest1).not.toBe(digest2);
    });
  });

  describe('verifyDigest', () => {
    it('should verify correct digest', () => {
      const body = '{"hello":"world"}';
      const digest = generateDigest(body);
      expect(verifyDigest(body, digest)).toBe(true);
    });

    it('should reject incorrect digest', () => {
      const body = '{"hello":"world"}';
      expect(verifyDigest(body, 'SHA-256=invalid')).toBe(false);
    });

    it('should reject missing SHA-256 prefix', () => {
      const body = '{"hello":"world"}';
      expect(verifyDigest(body, 'MD5=something')).toBe(false);
    });
  });

  describe('parseSignatureHeader', () => {
    it('should parse valid signature header', () => {
      const header = 'keyId="https://example.com/@alice#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc123"';
      const result = parseSignatureHeader(header);

      expect(result).not.toBeNull();
      expect(result!.keyId).toBe('https://example.com/@alice#main-key');
      expect(result!.algorithm).toBe('rsa-sha256');
      expect(result!.headers).toEqual(['(request-target)', 'host', 'date']);
      expect(result!.signature).toBe('abc123');
    });

    it('should return null for empty header', () => {
      expect(parseSignatureHeader('')).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseSignatureHeader('invalid')).toBeNull();
    });
  });

  describe('signRequest', () => {
    let publicKeyPem: string;
    let privateKeyPem: string;

    beforeAll(() => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      publicKeyPem = publicKey;
      privateKeyPem = privateKey;
    });

    it('should generate a valid signature header', () => {
      const signatureHeader = signRequest(
        'POST',
        'https://remote.example/inbox',
        privateKeyPem,
        'https://example.com/@alice#main-key'
      );

      expect(signatureHeader).toContain('keyId=');
      expect(signatureHeader).toContain('algorithm=');
      expect(signatureHeader).toContain('headers=');
      expect(signatureHeader).toContain('signature=');
    });

    it('should include all specified headers', () => {
      const headers = ['(request-target)', 'host', 'date', 'digest'];
      const signatureHeader = signRequest(
        'POST',
        'https://remote.example/inbox',
        privateKeyPem,
        'https://example.com/@alice#main-key',
        headers,
        { digest: 'SHA-256=test', date: new Date().toUTCString() }
      );

      const parsed = parseSignatureHeader(signatureHeader);
      expect(parsed).not.toBeNull();
      expect(parsed!.headers).toEqual(headers);
    });

    it('should produce a verifiable signature', () => {
      const url = 'https://remote.example/inbox';
      const dateValue = new Date().toUTCString();
      const headers = ['(request-target)', 'host', 'date'];

      const signatureHeader = signRequest(
        'GET',
        url,
        privateKeyPem,
        'https://example.com/@alice#main-key',
        headers,
        { date: dateValue }
      );

      const parsed = parseSignatureHeader(signatureHeader);
      expect(parsed).not.toBeNull();

      // Manually verify the signature
      const parsedUrl = new URL(url);
      const signatureString = [
        `(request-target): get ${parsedUrl.pathname}`,
        `host: ${parsedUrl.host}`,
        `date: ${dateValue}`
      ].join('\n');

      const verifier = crypto.createVerify('SHA256');
      verifier.update(signatureString, 'utf8');
      const isValid = verifier.verify(
        publicKeyPem,
        Buffer.from(parsed!.signature, 'base64')
      );
      expect(isValid).toBe(true);
    });
  });
});
