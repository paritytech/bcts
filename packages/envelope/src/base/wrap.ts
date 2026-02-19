/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 * Copyright © 2025-2026 Leonardo Amoroso Custodio
 * Copyright © 2026 Parity Technologies
 */

import { Envelope } from "./envelope";
import { EnvelopeError } from "./error";

/// Support for wrapping and unwrapping envelopes.
///
/// Wrapping allows treating an envelope (including its assertions) as a single
/// unit, making it possible to add assertions about the envelope as a whole.

/// Implementation of wrap()
Envelope.prototype.wrap = function (this: Envelope): Envelope {
  return Envelope.newWrapped(this);
};

/// Implementation of tryUnwrap()
Envelope.prototype.tryUnwrap = function (this: Envelope): Envelope {
  const c = this.subject().case();
  if (c.type === "wrapped") {
    return c.envelope;
  }
  throw EnvelopeError.notWrapped();
};

/// Implementation of unwrap() - alias for tryUnwrap()
Envelope.prototype.unwrap = function (this: Envelope): Envelope {
  return this.tryUnwrap();
};
