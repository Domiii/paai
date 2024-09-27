/**
 * @file
 * Mostly copied from https://github.com/Domiii/dbux/blob/master/dbux-common-node/src/util/pathUtil.js
 */

import * as fs from "fs";
import * as path from "path";
import { homedir } from "os";
import _commonAncestorPath from "common-ancestor-path";

export function realPathSyncNormalized(
  fpath: string,
  options?: { encoding?: BufferEncoding | null }
): string {
  return pathNormalized(fs.realpathSync(fpath, options));
}

export function pathResolve(...paths: string[]): string {
  return pathNormalized(path.resolve(...paths));
}

/**
 * @param paths
 * @returns {string}
 */
export function pathJoin(...paths: string[]): string {
  return pathNormalized(path.join(...paths));
}

/**
 * @param from Usually the shorter (potential parent/folder) path.
 * @param to The (usually) more concrete file path.
 */
export function pathRelative(from: string, to: string): string {
  from = pathNormalized(from);
  to = pathNormalized(to);
  const sep = "/";
  if (!from.endsWith(sep)) {
    from += "/";
  }
  if (!to.endsWith(sep)) {
    to += "/";
  }
  return pathNormalized(path.relative(from, to));
}

/**
 * It appears, VSCode is now not normalizing or normalizing to lower-case drive letter (e.g. in Uri.fspath!!!):
 * @see https://code.visualstudio.com/api/references/vscode-api#Uri
 * @see https://github.com/microsoft/vscode/issues/45760#issuecomment-373417966
 * @see https://github.com/microsoft/vscode/blob/94c9ea46838a9a619aeafb7e8afd1170c967bb55/test/unit/coverage.js#L81
 *
 * Before that (in 2016), they decided for upper-case drive letters:
 * @see https://github.com/microsoft/vscode/issues/9448
 * @see https://github.com/microsoft/vscode/commit/a6c845baf7fed4a186e3b744c5c14c0be53494fe
 */
export function normalizeDriveLetter(fpath: string): string {
  if (fpath && fpath[1] === ":") {
    fpath = fpath[0].toUpperCase() + fpath.substr(1);
  }
  return fpath;
}

export function pathNormalized(fpath: string): string {
  return fpath.replace(/\\/g, "/");
}

/**
 * In addition to standard normalization, also enforces upper-case drive letter.
 */
export function pathNormalizedForce(fpath: string): string {
  return normalizeDriveLetter(pathNormalized(fpath));
}

export function getPathRelativeToCommonAncestor(
  fpath: string,
  ...otherPaths: string[]
): string {
  const common = getCommonAncestorPath(fpath, ...otherPaths);
  return pathNormalizedForce((common && pathRelative(common, fpath)) || fpath);
}

/**
 * @see https://github.com/isaacs/common-ancestor-path#readme
 */
export function getCommonAncestorPath(...paths: string[]): string {
  // NOTE: the library requires OS-specific separators
  if (paths.length === 0) {
    return "";
  }
  paths = paths.map((p) => path.resolve(p));
  const result = _commonAncestorPath(...paths)!;
  return pathNormalized(result);
}

export function isFileInPath(parent: string, file: string): boolean {
  const relative = pathRelative(parent, file);
  return Boolean(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

export function renderPath(fpath: string): string {
  const home = homedir();
  if (fpath.startsWith(home)) {
    fpath = "~" + fpath.substring(home.length);
  }
  return fpath;
}
