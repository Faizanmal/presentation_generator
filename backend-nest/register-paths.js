/**
 * Runtime resolver for @shared/* → compiled dist/shared/*.
 * Used by start / start:dev / start:prod so Nest watch never leaves
 * bare "@shared/..." requires that Node cannot resolve.
 */
const Module = require('module');
const path = require('path');

const SHARED_PREFIX = '@shared/';
const SHARED_DIR = path.join(__dirname, 'dist', 'shared');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith(SHARED_PREFIX)) {
    const rest = request.slice(SHARED_PREFIX.length);
    const resolved = path.join(SHARED_DIR, rest);
    return originalResolveFilename.call(this, resolved, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
