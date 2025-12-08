/**
 * Hex dump utilities for CBOR data.
 *
 * Affordances for viewing the encoded binary representation of CBOR as hexadecimal.
 * Optionally annotates the output, breaking it up into semantically meaningful lines,
 * formatting dates, and adding names of known tags.
 *
 * @module dump
 */

import { type Cbor, MajorType, cborData } from "./cbor";
import { encodeVarInt } from "./varint";
import { flanked, sanitized } from "./string-util";
import type { TagsStore } from "./tags-store";
import { getGlobalTagsStore } from "./tags-store";
import { createTag } from "./tag";
import { CborError } from "./error";

/**
 * Options for hex formatting.
 */
export interface HexFormatOpts {
  /** Whether to annotate the hex dump with semantic information */
  annotate?: boolean;
  /** Optional tags store for resolving tag names */
  tagsStore?: TagsStore;
}

/**
 * Convert bytes to hex string.
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Convert hex string to bytes.
 */
export const hexToBytes = (hexString: string): Uint8Array => {
  const hex = hexString.replace(/\s/g, "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
};

/**
 * Returns the encoded hexadecimal representation of CBOR.
 *
 * @param cbor - CBOR value to convert
 * @returns Hex string
 */
export const hex = (cbor: Cbor): string => bytesToHex(cborData(cbor));

/**
 * Returns the encoded hexadecimal representation of CBOR with options.
 *
 * Optionally annotates the output, e.g., breaking the output up into
 * semantically meaningful lines, formatting dates, and adding names of
 * known tags.
 *
 * @param cbor - CBOR value to convert
 * @param opts - Formatting options
 * @returns Hex string (possibly annotated)
 */
export const hexOpt = (cbor: Cbor, opts: HexFormatOpts = {}): string => {
  if (opts.annotate !== true) {
    return hex(cbor);
  }

  const items = dumpItems(cbor, 0, opts);
  const noteColumn = items.reduce((largest, item) => {
    return Math.max(largest, item.formatFirstColumn().length);
  }, 0);

  // Round up to nearest multiple of 4
  const roundedNoteColumn = ((noteColumn + 4) & ~3) - 1;

  const lines = items.map((item) => item.format(roundedNoteColumn));
  return lines.join("\n");
};

/**
 * Returns the encoded hexadecimal representation of CBOR, with annotations.
 *
 * @param cbor - CBOR value to convert
 * @param tagsStore - Optional tags store for tag name resolution
 * @returns Annotated hex string
 */
export const hexAnnotated = (cbor: Cbor, tagsStore?: TagsStore): string => {
  // Use global tags store if not provided
  tagsStore ??= getGlobalTagsStore();
  return hexOpt(cbor, { annotate: true, tagsStore });
};

/**
 * Internal structure for dump items.
 */
class DumpItem {
  constructor(
    public level: number,
    public data: Uint8Array[],
    public note?: string,
  ) {}

  format(noteColumn: number): string {
    const column1 = this.formatFirstColumn();
    let column2 = "";
    let padding = "";

    if (this.note !== undefined) {
      const paddingCount = Math.max(1, Math.min(39, noteColumn) - column1.length + 1);
      padding = " ".repeat(paddingCount);
      column2 = `# ${this.note}`;
    }

    return column1 + padding + column2;
  }

  formatFirstColumn(): string {
    const indent = " ".repeat(this.level * 4);
    const hexParts = this.data.map(bytesToHex).filter((x) => x.length > 0);
    const hexStr = hexParts.join(" ");
    return indent + hexStr;
  }
}

/**
 * Generate dump items for a CBOR value (recursive).
 */
function dumpItems(cbor: Cbor, level: number, opts: HexFormatOpts): DumpItem[] {
  const items: DumpItem[] = [];

  switch (cbor.type) {
    case MajorType.Unsigned: {
      const data = cborData(cbor);
      items.push(new DumpItem(level, [data], `unsigned(${cbor.value})`));
      break;
    }

    case MajorType.Negative: {
      const data = cborData(cbor);
      const actualValue = typeof cbor.value === "bigint" ? -1n - cbor.value : -1 - cbor.value;
      items.push(new DumpItem(level, [data], `negative(${actualValue})`));
      break;
    }

    case MajorType.ByteString: {
      const header = encodeVarInt(cbor.value.length, MajorType.ByteString);
      items.push(new DumpItem(level, [header], `bytes(${cbor.value.length})`));

      if (cbor.value.length > 0) {
        let note: string | undefined = undefined;
        // Try to decode as UTF-8 string for annotation
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(cbor.value);
          const sanitizedText = sanitized(text);
          if (sanitizedText !== undefined && sanitizedText !== "") {
            note = flanked(sanitizedText, '"', '"');
          }
        } catch {
          // Not valid UTF-8, no annotation
        }

        items.push(new DumpItem(level + 1, [cbor.value], note));
      }
      break;
    }

    case MajorType.Text: {
      const utf8Data = new TextEncoder().encode(cbor.value);
      const header = encodeVarInt(utf8Data.length, MajorType.Text);
      const firstByte = header[0];
      if (firstByte === undefined) {
        throw new CborError({ type: "Custom", message: "Invalid varint encoding" });
      }
      const headerData = [new Uint8Array([firstByte]), header.slice(1)];

      items.push(new DumpItem(level, headerData, `text(${utf8Data.length})`));

      items.push(new DumpItem(level + 1, [utf8Data], flanked(cbor.value, '"', '"')));
      break;
    }

    case MajorType.Array: {
      const header = encodeVarInt(cbor.value.length, MajorType.Array);
      const firstByte = header[0];
      if (firstByte === undefined) {
        throw new CborError({ type: "Custom", message: "Invalid varint encoding" });
      }
      const headerData = [new Uint8Array([firstByte]), header.slice(1)];

      items.push(new DumpItem(level, headerData, `array(${cbor.value.length})`));

      for (const item of cbor.value) {
        items.push(...dumpItems(item, level + 1, opts));
      }
      break;
    }

    case MajorType.Map: {
      const header = encodeVarInt(cbor.value.size, MajorType.Map);
      const firstByte = header[0];
      if (firstByte === undefined) {
        throw new CborError({ type: "Custom", message: "Invalid varint encoding" });
      }
      const headerData = [new Uint8Array([firstByte]), header.slice(1)];

      items.push(new DumpItem(level, headerData, `map(${cbor.value.size})`));

      for (const entry of cbor.value.entriesArray) {
        items.push(...dumpItems(entry.key, level + 1, opts));
        items.push(...dumpItems(entry.value, level + 1, opts));
      }
      break;
    }

    case MajorType.Tagged: {
      const tagValue = cbor.tag;
      if (tagValue === undefined) {
        throw new CborError({ type: "Custom", message: "Tagged CBOR value must have a tag" });
      }
      const header = encodeVarInt(
        typeof tagValue === "bigint" ? Number(tagValue) : tagValue,
        MajorType.Tagged,
      );
      const firstByte = header[0];
      if (firstByte === undefined) {
        throw new CborError({ type: "Custom", message: "Invalid varint encoding" });
      }
      const headerData = [new Uint8Array([firstByte]), header.slice(1)];

      const noteComponents: string[] = [`tag(${tagValue})`];

      // Add tag name if tags store is provided
      const numericTagValue = typeof tagValue === "bigint" ? Number(tagValue) : tagValue;
      const tag = createTag(numericTagValue);
      const tagName = opts.tagsStore?.assignedNameForTag(tag);
      if (tagName !== undefined) {
        noteComponents.push(tagName);
      }

      const tagNote = noteComponents.join(" ");

      items.push(new DumpItem(level, headerData, tagNote));

      items.push(...dumpItems(cbor.value, level + 1, opts));
      break;
    }

    case MajorType.Simple: {
      const data = cborData(cbor);
      const simple = cbor.value;
      let note: string;

      if (simple.type === "True") {
        note = "true";
      } else if (simple.type === "False") {
        note = "false";
      } else if (simple.type === "Null") {
        note = "null";
      } else if (simple.type === "Float") {
        note = `${simple.value}`;
      } else {
        note = "simple";
      }

      items.push(new DumpItem(level, [data], note));
      break;
    }
  }

  return items;
}
