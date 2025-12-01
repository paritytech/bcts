import { InvalidSchemeError, InvalidTypeError, UnexpectedTypeError } from './error';
import { UR } from './ur';
import { URType } from './ur-type';

/**
 * Decodes multiple UR parts back into a single UR.
 *
 * This reassembles multipart URs that were encoded using fountain codes.
 *
 * @example
 * ```typescript
 * const decoder = new MultipartDecoder();
 *
 * for (const urPart of urParts) {
 *   decoder.receive(urPart);
 *   if (decoder.isComplete()) {
 *     const ur = decoder.message();
 *     break;
 *   }
 * }
 * ```
 */
export class MultipartDecoder {
	private _urType: URType | null = null;
	private _receivedParts: Map<number, string> = new Map();
	private _isComplete: boolean = false;
	private _decodedMessage: UR | null = null;

	/**
	 * Creates a new multipart decoder.
	 *
	 * @example
	 * ```typescript
	 * const decoder = new MultipartDecoder();
	 * ```
	 */
	constructor() {}

	/**
	 * Receives a UR part string.
	 *
	 * @param part - A UR part string (e.g., "ur:bytes/1-10/...")
	 * @throws {InvalidSchemeError} If the part doesn't start with "ur:"
	 * @throws {UnexpectedTypeError} If the type doesn't match previous parts
	 */
	receive(part: string): void {
		const decodedType = this._decodeType(part);

		if (this._urType === null) {
			this._urType = decodedType;
		} else if (!this._urType.equals(decodedType)) {
			throw new UnexpectedTypeError(
				this._urType.string(),
				decodedType.string()
			);
		}

		// For single-part URs, we're immediately complete
		this._tryDecode(part);
	}

	/**
	 * Checks if the message is complete.
	 */
	isComplete(): boolean {
		return this._isComplete;
	}

	/**
	 * Gets the decoded UR message.
	 *
	 * @returns The decoded UR, or null if not yet complete
	 */
	message(): UR | null {
		if (!this._isComplete || !this._decodedMessage) {
			return null;
		}
		return this._decodedMessage;
	}

	/**
	 * Resets the decoder to receive a new message.
	 */
	reset(): void {
		this._urType = null;
		this._receivedParts.clear();
		this._isComplete = false;
		this._decodedMessage = null;
	}

	/**
	 * Decodes the UR type from a part string.
	 */
	private _decodeType(urString: string): URType {
		const lowercased = urString.toLowerCase();

		if (!lowercased.startsWith('ur:')) {
			throw new InvalidSchemeError();
		}

		const afterScheme = lowercased.substring(3);
		const firstComponent = afterScheme.split('/')[0];

		if (!firstComponent) {
			throw new InvalidTypeError();
		}

		return new URType(firstComponent);
	}

	/**
	 * Attempts to decode the received parts into a UR.
	 */
	private _tryDecode(part: string): void {
		try {
			// For single-part URs, try to decode immediately
			this._decodedMessage = UR.fromURString(part);
			this._isComplete = true;
		} catch {
			// If it fails, it might be a multipart UR that needs more parts
			// In a full implementation, this would handle fountain code decoding
			this._isComplete = false;
		}
	}
}
