/**
 * An expected failure caused by user input (bad page range, wrong password, …).
 * Its message is written for end users and shown verbatim; any other error is a bug.
 */
export class UserError extends Error {
  /** @param {string} message @param {{ cause?: unknown }} [options] */
  constructor(message, options) {
    super(message, options);
    this.name = 'UserError';
  }
}
