import { describe, it, expect } from '@jest/globals';
import {
  UR,
  URType,
  URError,
  InvalidSchemeError,
  TypeUnspecifiedError,
  InvalidTypeError,
  UnexpectedTypeError,
  NotSinglePartError,
  isURTypeChar,
  isValidURType,
  validateURType,
  BYTEWORDS,
  BYTEMOJIS,
  BYTEWORDS_MAP,
  encodeBytewordsIdentifier,
  encodeBytemojisIdentifier,
  UREncodable,
  URDecodable,
  URCodable,
  isUREncodable,
  isURDecodable,
  isURCodable,
  MultipartEncoder,
  MultipartDecoder,
} from '../src';
import { cbor } from '@blockchain-commons/dcbor';

describe('URType', () => {
  it('creates a valid UR type with lowercase letters', () => {
    const urType = new URType('bytes');
    expect(urType.string()).toBe('bytes');
  });

  it('creates a valid UR type with numbers', () => {
    const urType = new URType('bytes2');
    expect(urType.string()).toBe('bytes2');
  });

  it('creates a valid UR type with hyphens', () => {
    const urType = new URType('my-type');
    expect(urType.string()).toBe('my-type');
  });

  it('throws error for uppercase letters', () => {
    expect(() => new URType('Bytes')).toThrow(InvalidTypeError);
  });

  it('throws error for empty string', () => {
    expect(() => new URType('')).toThrow(InvalidTypeError);
  });

  it('throws error for special characters', () => {
    expect(() => new URType('bytes@')).toThrow(InvalidTypeError);
  });

  it('compares URTypes for equality', () => {
    const type1 = new URType('bytes');
    const type2 = new URType('bytes');
    const type3 = new URType('text');

    expect(type1.equals(type2)).toBe(true);
    expect(type1.equals(type3)).toBe(false);
  });

  it('returns string representation', () => {
    const urType = new URType('bytes');
    expect(urType.toString()).toBe('bytes');
  });
});

describe('Utility Functions', () => {
  it('validates UR type characters', () => {
    expect(isURTypeChar('a')).toBe(true);
    expect(isURTypeChar('z')).toBe(true);
    expect(isURTypeChar('0')).toBe(true);
    expect(isURTypeChar('9')).toBe(true);
    expect(isURTypeChar('-')).toBe(true);

    expect(isURTypeChar('A')).toBe(false);
    expect(isURTypeChar('Z')).toBe(false);
    expect(isURTypeChar(' ')).toBe(false);
    expect(isURTypeChar('@')).toBe(false);
  });

  it('validates complete UR type strings', () => {
    expect(isValidURType('bytes')).toBe(true);
    expect(isValidURType('text')).toBe(true);
    expect(isValidURType('my-type')).toBe(true);
    expect(isValidURType('type123')).toBe(true);

    expect(isValidURType('')).toBe(false);
    expect(isValidURType('Bytes')).toBe(false);
    expect(isValidURType('my@type')).toBe(false);
  });

  it('validates URType or throws error', () => {
    expect(() => validateURType('bytes')).not.toThrow();
    expect(() => validateURType('Bytes')).toThrow(InvalidTypeError);
    expect(() => validateURType('')).toThrow(InvalidTypeError);
  });

  it('contains bytewords array with 256 entries', () => {
    expect(BYTEWORDS).toHaveLength(256);
    expect(typeof BYTEWORDS[0]).toBe('string');
  });

  it('contains bytemojis array with 256 entries', () => {
    expect(BYTEMOJIS).toHaveLength(256);
    expect(typeof BYTEMOJIS[0]).toBe('string');
  });

  it('creates bytewords map for lookups', () => {
    expect(BYTEWORDS_MAP).toBeDefined();
    expect(BYTEWORDS_MAP.get('able')).toBe(0);
  });
});

describe('UR', () => {
  it('creates a UR with string type and CBOR data', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);

    expect(ur.urTypeStr()).toBe('bytes');
  });

  it('creates a UR with URType object', () => {
    const cborData = cbor(42);
    const urType = new URType('text');
    const ur = UR.new(urType, cborData);

    expect(ur.urTypeStr()).toBe('text');
  });

  it('converts UR to string', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const urString = ur.string();

    expect(urString).toMatch(/^ur:bytes\//);
  });

  it('decodes a UR string back to UR', () => {
    const cborData = cbor(42);
    const ur1 = UR.new('bytes', cborData);
    const urString = ur1.string();

    const ur2 = UR.fromURString(urString);
    expect(ur2.urTypeStr()).toBe('bytes');
  });

  it('round-trips UR encoding and decoding', () => {
    const cborData = cbor(123);
    const ur1 = UR.new('test', cborData);
    const urString = ur1.string();

    const ur2 = UR.fromURString(urString);
    expect(ur2.urTypeStr()).toBe(ur1.urTypeStr());
  });

  it('throws error for invalid scheme', () => {
    expect(() => UR.fromURString('invalid:bytes/...')).toThrow(InvalidSchemeError);
  });

  it('throws error for unspecified type', () => {
    expect(() => UR.fromURString('ur:/...')).toThrow(TypeUnspecifiedError);
  });

  it('provides QR string representation', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const qrString = ur.qrString();

    expect(typeof qrString).toBe('string');
    expect(qrString).toMatch(/^UR:/i);
  });

  it('checks UR type compatibility', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);

    expect(() => ur.checkType('bytes')).not.toThrow();
    expect(() => ur.checkType('text')).toThrow(UnexpectedTypeError);
  });
});

describe('Error Types', () => {
  it('throws URError base class', () => {
    expect(() => {
      throw new URError('Test error');
    }).toThrow(URError);
  });

  it('throws InvalidSchemeError', () => {
    expect(() => {
      throw new InvalidSchemeError();
    }).toThrow(InvalidSchemeError);
  });

  it('throws TypeUnspecifiedError', () => {
    expect(() => {
      throw new TypeUnspecifiedError();
    }).toThrow(TypeUnspecifiedError);
  });

  it('throws InvalidTypeError', () => {
    expect(() => {
      throw new InvalidTypeError();
    }).toThrow(InvalidTypeError);
  });

  it('throws NotSinglePartError', () => {
    expect(() => {
      throw new NotSinglePartError();
    }).toThrow(NotSinglePartError);
  });

  it('throws UnexpectedTypeError with context', () => {
    expect(() => {
      throw new UnexpectedTypeError('bytes', 'text');
    }).toThrow(UnexpectedTypeError);

    try {
      throw new UnexpectedTypeError('bytes', 'text');
    } catch (e) {
      expect((e as Error).message).toContain('bytes');
      expect((e as Error).message).toContain('text');
    }
  });
});

describe('Trait Interfaces', () => {
  class MockEncodable implements UREncodable {
    ur(): UR {
      const cborData = cbor(42);
      return UR.new('test', cborData);
    }

    urString(): string {
      return this.ur().string();
    }
  }

  class MockDecodable implements URDecodable {
    fromUR(ur: UR): MockDecodable {
      return new MockDecodable();
    }
  }

  class MockCodable implements URCodable {
    ur(): UR {
      const cborData = cbor(42);
      return UR.new('test', cborData);
    }

    urString(): string {
      return this.ur().string();
    }

    fromUR(ur: UR): MockCodable {
      return new MockCodable();
    }
  }

  it('detects UREncodable objects', () => {
    const encodable = new MockEncodable();
    expect(isUREncodable(encodable)).toBe(true);
    expect(isUREncodable({ ur: 'not a function' })).toBe(false);
    expect(isUREncodable(null)).toBe(false);
  });

  it('detects URDecodable objects', () => {
    const decodable = new MockDecodable();
    expect(isURDecodable(decodable)).toBe(true);
    expect(isURDecodable({ fromUR: 'not a function' })).toBe(false);
    expect(isURDecodable(null)).toBe(false);
  });

  it('detects URCodable objects', () => {
    const codable = new MockCodable();
    expect(isURCodable(codable)).toBe(true);
    expect(isURCodable(new MockEncodable())).toBe(false);
    expect(isURCodable(new MockDecodable())).toBe(false);
  });
});

describe('MultipartEncoder', () => {
  it('creates encoder with UR and max fragment length', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder).toBeDefined();
  });

  it('throws error for invalid max fragment length', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);

    expect(() => new MultipartEncoder(ur, 0)).toThrow(URError);
    expect(() => new MultipartEncoder(ur, -1)).toThrow(URError);
  });

  it('gets next part from encoder', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    const part = encoder.nextPart();
    expect(typeof part).toBe('string');
  });

  it('tracks current index', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder.currentIndex()).toBe(0);
    encoder.nextPart();
    expect(encoder.currentIndex()).toBe(1);
  });

  it('reports parts count', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder.partsCount()).toBeGreaterThan(0);
  });

  it('checks if encoding is complete', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    expect(encoder.isComplete()).toBe(false);
    while (!encoder.isComplete()) {
      encoder.nextPart();
    }
    expect(encoder.isComplete()).toBe(true);
  });

  it('resets encoder to start', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const encoder = new MultipartEncoder(ur, 100);

    encoder.nextPart();
    expect(encoder.currentIndex()).toBe(1);

    encoder.reset();
    expect(encoder.currentIndex()).toBe(0);
  });
});

describe('MultipartDecoder', () => {
  it('creates decoder', () => {
    const decoder = new MultipartDecoder();
    expect(decoder).toBeDefined();
  });

  it('receives UR part string', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const urString = ur.string();

    const decoder = new MultipartDecoder();
    expect(() => decoder.receive(urString)).not.toThrow();
  });

  it('throws error for invalid scheme', () => {
    const decoder = new MultipartDecoder();
    expect(() => decoder.receive('invalid:bytes/...')).toThrow(InvalidSchemeError);
  });

  it('throws error for invalid type format', () => {
    const decoder = new MultipartDecoder();
    expect(() => decoder.receive('ur:/...')).toThrow(InvalidTypeError);
  });

  it('checks if message is complete', () => {
    const decoder = new MultipartDecoder();
    expect(decoder.isComplete()).toBe(false);
  });

  it('retrieves message after complete', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);
    const urString = ur.string();

    const decoder = new MultipartDecoder();
    decoder.receive(urString);

    if (decoder.isComplete()) {
      const message = decoder.message();
      expect(message).toBeDefined();
      expect(message?.urTypeStr()).toBe('bytes');
    }
  });

  it('returns null message when not complete', () => {
    const decoder = new MultipartDecoder();
    const message = decoder.message();
    expect(message).toBeNull();
  });

  it('throws error for mismatched types', () => {
    const cborData = cbor(42);
    const ur1 = UR.new('bytes', cborData);
    const ur2 = UR.new('text', cborData);

    const decoder = new MultipartDecoder();
    decoder.receive(ur1.string());

    expect(() => decoder.receive(ur2.string())).toThrow(UnexpectedTypeError);
  });

  it('resets decoder', () => {
    const cborData = cbor(42);
    const ur = UR.new('bytes', cborData);

    const decoder = new MultipartDecoder();
    decoder.receive(ur.string());

    decoder.reset();
    expect(decoder.isComplete()).toBe(false);
    expect(decoder.message()).toBeNull();
  });
});
