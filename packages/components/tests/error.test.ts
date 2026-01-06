/**
 * Tests for the CryptoError class and ErrorKind enum
 *
 * Tests for:
 * - All error factory methods
 * - ErrorKind enum values
 * - Error kind checking methods
 * - Structured error data access
 * - Type guards
 */

import { CryptoError, ErrorKind, isError, isCryptoError, isCryptoErrorKind } from "../src";

describe("ErrorKind enum", () => {
  it("should have all 17 error kinds", () => {
    expect(Object.keys(ErrorKind)).toHaveLength(17);
  });

  it("should have correct string values", () => {
    expect(ErrorKind.InvalidSize).toBe("InvalidSize");
    expect(ErrorKind.InvalidData).toBe("InvalidData");
    expect(ErrorKind.DataTooShort).toBe("DataTooShort");
    expect(ErrorKind.Crypto).toBe("Crypto");
    expect(ErrorKind.Cbor).toBe("Cbor");
    expect(ErrorKind.Sskr).toBe("Sskr");
    expect(ErrorKind.Ssh).toBe("Ssh");
    expect(ErrorKind.Uri).toBe("Uri");
    expect(ErrorKind.Compression).toBe("Compression");
    expect(ErrorKind.PostQuantum).toBe("PostQuantum");
    expect(ErrorKind.LevelMismatch).toBe("LevelMismatch");
    expect(ErrorKind.SshAgent).toBe("SshAgent");
    expect(ErrorKind.Hex).toBe("Hex");
    expect(ErrorKind.Utf8).toBe("Utf8");
    expect(ErrorKind.Env).toBe("Env");
    expect(ErrorKind.SshAgentClient).toBe("SshAgentClient");
    expect(ErrorKind.General).toBe("General");
  });
});

describe("CryptoError factory methods", () => {
  describe("InvalidSize errors", () => {
    it("should create invalidSize error", () => {
      const error = CryptoError.invalidSize(32, 16);
      expect(error.message).toBe("invalid data size: expected 32, got 16");
      expect(error.errorKind).toBe(ErrorKind.InvalidSize);
      expect(error.isInvalidSize()).toBe(true);
    });

    it("should create invalidSizeForType error", () => {
      const error = CryptoError.invalidSizeForType("key", 32, 16);
      expect(error.message).toBe("invalid key size: expected 32, got 16");
      expect(error.errorKind).toBe(ErrorKind.InvalidSize);
      if (error.isInvalidSize()) {
        expect(error.errorData.dataType).toBe("key");
        expect(error.errorData.expected).toBe(32);
        expect(error.errorData.actual).toBe(16);
      }
    });
  });

  describe("InvalidData errors", () => {
    it("should create invalidData error", () => {
      const error = CryptoError.invalidData("corrupted bytes");
      expect(error.message).toBe("invalid data: corrupted bytes");
      expect(error.errorKind).toBe(ErrorKind.InvalidData);
      expect(error.isInvalidData()).toBe(true);
    });

    it("should create invalidDataForType error", () => {
      const error = CryptoError.invalidDataForType("signature", "wrong format");
      expect(error.message).toBe("invalid signature: wrong format");
      expect(error.errorKind).toBe(ErrorKind.InvalidData);
      if (error.isInvalidData()) {
        expect(error.errorData.dataType).toBe("signature");
        expect(error.errorData.reason).toBe("wrong format");
      }
    });

    it("should create invalidFormat error", () => {
      const error = CryptoError.invalidFormat("missing header");
      expect(error.message).toBe("invalid format: missing header");
      expect(error.errorKind).toBe(ErrorKind.InvalidData);
    });

    it("should create invalidInput error", () => {
      const error = CryptoError.invalidInput("empty string");
      expect(error.message).toBe("invalid input: empty string");
      expect(error.errorKind).toBe(ErrorKind.InvalidData);
    });
  });

  describe("DataTooShort errors", () => {
    it("should create dataTooShort error", () => {
      const error = CryptoError.dataTooShort("header", 8, 4);
      expect(error.message).toBe("data too short: header expected at least 8, got 4");
      expect(error.errorKind).toBe(ErrorKind.DataTooShort);
      expect(error.isDataTooShort()).toBe(true);
      if (error.isDataTooShort()) {
        expect(error.errorData.dataType).toBe("header");
        expect(error.errorData.minimum).toBe(8);
        expect(error.errorData.actual).toBe(4);
      }
    });
  });

  describe("Crypto errors", () => {
    it("should create crypto error", () => {
      const error = CryptoError.crypto("signature verification failed");
      expect(error.message).toBe("cryptographic operation failed: signature verification failed");
      expect(error.errorKind).toBe(ErrorKind.Crypto);
      expect(error.isCrypto()).toBe(true);
    });

    it("should create cryptoOperation error (alias)", () => {
      const error = CryptoError.cryptoOperation("key generation failed");
      expect(error.message).toBe("cryptographic operation failed: key generation failed");
      expect(error.errorKind).toBe(ErrorKind.Crypto);
    });
  });

  describe("CBOR errors", () => {
    it("should create cbor error", () => {
      const error = CryptoError.cbor("unexpected tag");
      expect(error.message).toBe("CBOR error: unexpected tag");
      expect(error.errorKind).toBe(ErrorKind.Cbor);
      expect(error.isCbor()).toBe(true);
    });
  });

  describe("SSKR errors", () => {
    it("should create sskr error", () => {
      const error = CryptoError.sskr("insufficient shares");
      expect(error.message).toBe("SSKR error: insufficient shares");
      expect(error.errorKind).toBe(ErrorKind.Sskr);
      expect(error.isSskr()).toBe(true);
    });
  });

  describe("SSH errors", () => {
    it("should create ssh error", () => {
      const error = CryptoError.ssh("key parsing failed");
      expect(error.message).toBe("SSH operation failed: key parsing failed");
      expect(error.errorKind).toBe(ErrorKind.Ssh);
      expect(error.isSsh()).toBe(true);
    });
  });

  describe("URI errors", () => {
    it("should create uri error", () => {
      const error = CryptoError.uri("missing scheme");
      expect(error.message).toBe("invalid URI: missing scheme");
      expect(error.errorKind).toBe(ErrorKind.Uri);
      expect(error.isUri()).toBe(true);
    });
  });

  describe("Compression errors", () => {
    it("should create compression error", () => {
      const error = CryptoError.compression("decompression failed");
      expect(error.message).toBe("compression error: decompression failed");
      expect(error.errorKind).toBe(ErrorKind.Compression);
      expect(error.isCompression()).toBe(true);
    });
  });

  describe("PostQuantum errors", () => {
    it("should create postQuantum error", () => {
      const error = CryptoError.postQuantum("ML-KEM decapsulation failed");
      expect(error.message).toBe("post-quantum cryptography error: ML-KEM decapsulation failed");
      expect(error.errorKind).toBe(ErrorKind.PostQuantum);
      expect(error.isPostQuantum()).toBe(true);
    });
  });

  describe("LevelMismatch errors", () => {
    it("should create levelMismatch error", () => {
      const error = CryptoError.levelMismatch();
      expect(error.message).toBe("signature level does not match key level");
      expect(error.errorKind).toBe(ErrorKind.LevelMismatch);
      expect(error.isLevelMismatch()).toBe(true);
    });
  });

  describe("SSH Agent errors", () => {
    it("should create sshAgent error", () => {
      const error = CryptoError.sshAgent("agent not available");
      expect(error.message).toBe("SSH agent error: agent not available");
      expect(error.errorKind).toBe(ErrorKind.SshAgent);
      expect(error.isSshAgent()).toBe(true);
    });
  });

  describe("Hex errors", () => {
    it("should create hex error", () => {
      const error = CryptoError.hex("invalid character");
      expect(error.message).toBe("hex decoding error: invalid character");
      expect(error.errorKind).toBe(ErrorKind.Hex);
      expect(error.isHex()).toBe(true);
    });
  });

  describe("UTF-8 errors", () => {
    it("should create utf8 error", () => {
      const error = CryptoError.utf8("invalid byte sequence");
      expect(error.message).toBe("UTF-8 conversion error: invalid byte sequence");
      expect(error.errorKind).toBe(ErrorKind.Utf8);
      expect(error.isUtf8()).toBe(true);
    });
  });

  describe("Env errors", () => {
    it("should create env error", () => {
      const error = CryptoError.env("variable not found");
      expect(error.message).toBe("environment variable error: variable not found");
      expect(error.errorKind).toBe(ErrorKind.Env);
      expect(error.isEnv()).toBe(true);
    });
  });

  describe("SSH Agent Client errors", () => {
    it("should create sshAgentClient error", () => {
      const error = CryptoError.sshAgentClient("connection refused");
      expect(error.message).toBe("SSH agent client error: connection refused");
      expect(error.errorKind).toBe(ErrorKind.SshAgentClient);
      expect(error.isSshAgentClient()).toBe(true);
    });
  });

  describe("General errors", () => {
    it("should create general error", () => {
      const error = CryptoError.general("something went wrong");
      expect(error.message).toBe("something went wrong");
      expect(error.errorKind).toBe(ErrorKind.General);
      expect(error.isGeneral()).toBe(true);
    });
  });
});

describe("CryptoError kind checking", () => {
  it("isKind should correctly identify error kinds", () => {
    const cryptoErr = CryptoError.crypto("test");
    expect(cryptoErr.isKind(ErrorKind.Crypto)).toBe(true);
    expect(cryptoErr.isKind(ErrorKind.General)).toBe(false);
  });

  it("each error kind should only match its own checker", () => {
    const errors = [
      { error: CryptoError.invalidSize(1, 2), checker: "isInvalidSize" },
      { error: CryptoError.invalidData("test"), checker: "isInvalidData" },
      { error: CryptoError.dataTooShort("test", 1, 0), checker: "isDataTooShort" },
      { error: CryptoError.crypto("test"), checker: "isCrypto" },
      { error: CryptoError.cbor("test"), checker: "isCbor" },
      { error: CryptoError.sskr("test"), checker: "isSskr" },
      { error: CryptoError.ssh("test"), checker: "isSsh" },
      { error: CryptoError.uri("test"), checker: "isUri" },
      { error: CryptoError.compression("test"), checker: "isCompression" },
      { error: CryptoError.postQuantum("test"), checker: "isPostQuantum" },
      { error: CryptoError.levelMismatch(), checker: "isLevelMismatch" },
      { error: CryptoError.sshAgent("test"), checker: "isSshAgent" },
      { error: CryptoError.hex("test"), checker: "isHex" },
      { error: CryptoError.utf8("test"), checker: "isUtf8" },
      { error: CryptoError.env("test"), checker: "isEnv" },
      { error: CryptoError.sshAgentClient("test"), checker: "isSshAgentClient" },
      { error: CryptoError.general("test"), checker: "isGeneral" },
    ];

    for (const { error, checker } of errors) {
      const method = error[checker as keyof CryptoError] as () => boolean;
      expect(method.call(error)).toBe(true);

      // Check that other checkers return false
      for (const { checker: otherChecker } of errors) {
        if (otherChecker !== checker) {
          const otherMethod = error[otherChecker as keyof CryptoError] as () => boolean;
          expect(otherMethod.call(error)).toBe(false);
        }
      }
    }
  });
});

describe("Type guards", () => {
  describe("isError", () => {
    it("should return true for Error instances", () => {
      expect(isError(new Error("test"))).toBe(true);
      expect(isError(CryptoError.general("test"))).toBe(true);
    });

    it("should return false for non-errors", () => {
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError("error")).toBe(false);
      expect(isError({ message: "error" })).toBe(false);
    });
  });

  describe("isCryptoError", () => {
    it("should return true for CryptoError instances", () => {
      expect(isCryptoError(CryptoError.general("test"))).toBe(true);
      expect(isCryptoError(CryptoError.crypto("test"))).toBe(true);
    });

    it("should return false for regular Error instances", () => {
      expect(isCryptoError(new Error("test"))).toBe(false);
    });

    it("should return false for non-errors", () => {
      expect(isCryptoError(null)).toBe(false);
      expect(isCryptoError("error")).toBe(false);
    });
  });

  describe("isCryptoErrorKind", () => {
    it("should return true for matching error kind", () => {
      const error = CryptoError.crypto("test");
      expect(isCryptoErrorKind(error, ErrorKind.Crypto)).toBe(true);
    });

    it("should return false for non-matching error kind", () => {
      const error = CryptoError.crypto("test");
      expect(isCryptoErrorKind(error, ErrorKind.General)).toBe(false);
    });

    it("should return false for regular Error", () => {
      const error = new Error("test");
      expect(isCryptoErrorKind(error, ErrorKind.General)).toBe(false);
    });
  });
});

describe("CryptoError properties", () => {
  it("should have correct name", () => {
    const error = CryptoError.general("test");
    expect(error.name).toBe("CryptoError");
  });

  it("should be instanceof Error", () => {
    const error = CryptoError.general("test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CryptoError);
  });

  it("should have stack trace", () => {
    const error = CryptoError.general("test");
    expect(error.stack).toBeDefined();
  });
});

describe("Structured error data", () => {
  it("InvalidSize should have structured data", () => {
    const error = CryptoError.invalidSizeForType("nonce", 12, 8);
    expect(error.errorData).toEqual({
      kind: ErrorKind.InvalidSize,
      dataType: "nonce",
      expected: 12,
      actual: 8,
    });
  });

  it("InvalidData should have structured data", () => {
    const error = CryptoError.invalidDataForType("tag", "not valid");
    expect(error.errorData).toEqual({
      kind: ErrorKind.InvalidData,
      dataType: "tag",
      reason: "not valid",
    });
  });

  it("DataTooShort should have structured data", () => {
    const error = CryptoError.dataTooShort("buffer", 16, 8);
    expect(error.errorData).toEqual({
      kind: ErrorKind.DataTooShort,
      dataType: "buffer",
      minimum: 16,
      actual: 8,
    });
  });

  it("Message-only errors should have message in data", () => {
    const error = CryptoError.crypto("failed");
    expect(error.errorData).toEqual({
      kind: ErrorKind.Crypto,
      message: "failed",
    });
  });

  it("LevelMismatch should only have kind", () => {
    const error = CryptoError.levelMismatch();
    expect(error.errorData).toEqual({
      kind: ErrorKind.LevelMismatch,
    });
  });
});
