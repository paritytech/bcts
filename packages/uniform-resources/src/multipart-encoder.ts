import { UR } from './ur';
import { URError } from './error';

/**
 * Encodes a UR as multiple parts using fountain codes.
 *
 * This allows large CBOR structures to be split into multiple UR strings
 * that can be transmitted separately and reassembled.
 *
 * @example
 * ```typescript
 * const ur = UR.new('bytes', cbor);
 * const encoder = new MultipartEncoder(ur, 100);
 *
 * while (!encoder.isComplete()) {
 *   const part = encoder.nextPart();
 *   console.log(part); // "ur:bytes/1-10/..."
 * }
 * ```
 */
export class MultipartEncoder {
	private _ur: UR;
	private _maxFragmentLen: number;
	private _currentIndex: number = 0;
	private _parts: Map<number, string> = new Map();

	/**
	 * Creates a new multipart encoder for the given UR.
	 *
	 * @param ur - The UR to encode
	 * @param maxFragmentLen - Maximum length of each fragment
	 * @throws {URError} If encoding fails
	 *
	 * @example
	 * ```typescript
	 * const encoder = new MultipartEncoder(ur, 100);
	 * ```
	 */
	constructor(ur: UR, maxFragmentLen: number) {
		if (maxFragmentLen < 1) {
			throw new URError('Max fragment length must be at least 1');
		}
		this._ur = ur;
		this._maxFragmentLen = maxFragmentLen;

		// Note: Full fountain code implementation would go here
		// For now, this is a placeholder that implements the API
		this._initializeEncoding();
	}

	private _initializeEncoding(): void {
		// This would use a fountain code library to generate parts
		// For now, we generate a single part
		const urString = this._ur.string();
		this._parts.set(0, urString);
	}

	/**
	 * Gets the next part of the encoding.
	 *
	 * @returns The next UR string part
	 * @throws {URError} If encoding fails
	 */
	nextPart(): string {
		if (this._currentIndex >= this._parts.size) {
			throw new URError('No more parts available');
		}

		const part = this._parts.get(this._currentIndex);
		if (!part) {
			throw new URError('Failed to generate part');
		}

		this._currentIndex++;
		return part;
	}

	/**
	 * Gets the current part index.
	 */
	currentIndex(): number {
		return this._currentIndex;
	}

	/**
	 * Gets the total number of parts (only available after full generation).
	 *
	 * For fountain codes, this may be approximate or unknown until completion.
	 */
	partsCount(): number {
		return this._parts.size;
	}

	/**
	 * Checks if encoding is complete.
	 */
	isComplete(): boolean {
		return this._currentIndex >= this._parts.size;
	}

	/**
	 * Resets the encoder to start from the beginning.
	 */
	reset(): void {
		this._currentIndex = 0;
	}
}
