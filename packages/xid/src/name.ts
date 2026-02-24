/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Parity Technologies
 *
 *
 * XID Name (Nickname) Interface
 *
 * Provides the HasNickname interface for objects that can have a nickname.
 *
 * Ported from bc-xid-rust/src/name.rs
 */

import { XIDError } from "./error";

/**
 * Interface for types that have a nickname.
 */
export interface HasNickname {
  /**
   * Get the nickname for this object.
   */
  nickname(): string;

  /**
   * Set the nickname for this object.
   */
  setNickname(name: string): void;
}

/**
 * Helper methods for HasNickname implementers.
 */
export const HasNicknameMixin = {
  /**
   * Add a nickname, throwing if one already exists or is empty.
   */
  addNickname(obj: HasNickname, name: string): void {
    if (obj.nickname() !== "") {
      throw XIDError.duplicate("nickname");
    }
    if (name === "") {
      throw XIDError.emptyValue("nickname");
    }
    obj.setNickname(name);
  },
};
