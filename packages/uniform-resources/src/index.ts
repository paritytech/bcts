// Core types
export { UR } from './ur';
export { URType } from './ur-type';

// Error types
export {
	URError,
	InvalidSchemeError,
	TypeUnspecifiedError,
	InvalidTypeError,
	NotSinglePartError,
	UnexpectedTypeError,
	BytewordsError,
	CBORError,
	isError,
} from './error';

export type { Result } from './error';

// Traits/Interfaces
export { isUREncodable } from './ur-encodable';
export type { UREncodable } from './ur-encodable';
export { isURDecodable } from './ur-decodable';
export type { URDecodable } from './ur-decodable';
export { isURCodable } from './ur-codable';
export type { URCodable } from './ur-codable';

// Multipart encoding/decoding
export { MultipartEncoder } from './multipart-encoder';
export { MultipartDecoder } from './multipart-decoder';

// Utilities
export {
	isURTypeChar,
	isValidURType,
	validateURType,
	BYTEWORDS,
	BYTEWORDS_MAP,
	BYTEMOJIS,
	encodeBytewordsIdentifier,
	encodeBytemojisIdentifier,
} from './utils';
