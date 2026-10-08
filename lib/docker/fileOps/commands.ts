/**
 * File Operation Command Builders
 *
 * Every command that touches the project tree runs with `-u developer`, so
 * files are created and modified by the unprivileged build user (UID 1000,
 * created in the Dockerfile). Running file operations as root left root-owned
 * files behind that the `developer` build user could not overwrite, which broke
 * the next `cargo build` / `stellar contract build`.
 *
 * These builders are pure functions so the generated command strings can be
 * asserted in unit tests without spawning a container.
 */

import { escapeShellArg } from '../utils';

/** The unprivileged user every file operation must run as. */
export const FILE_OPS_USER = 'developer';

/** `docker exec` prefix pinned to the unprivileged file-operations user. */
export function fileOpExec(containerName: string, command: string): string {
  return `docker exec -u ${FILE_OPS_USER} ${containerName} ${command}`;
}

export function buildTestFileCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `test -f ${fullPath} && echo "exists" || echo "missing"`);
}

export function buildTestDirCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `test -d ${fullPath} && echo "exists" || echo "missing"`);
}

export function buildFindFilesCommand(containerName: string, searchPath: string): string {
  return fileOpExec(containerName, `find ${searchPath} -type f 2>/dev/null`);
}

export function buildFindByNameCommand(
  containerName: string,
  searchPath: string,
  name: string
): string {
  return fileOpExec(
    containerName,
    `find ${searchPath} -name ${escapeShellArg(name)} 2>/dev/null || true`
  );
}

export function buildReadFileCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `cat ${fullPath}`);
}

export function buildWriteFileCommand(
  containerName: string,
  fullPath: string,
  base64Content: string
): string {
  return fileOpExec(
    containerName,
    `sh -c "echo ${escapeShellArg(base64Content)} | base64 -d > ${fullPath}"`
  );
}

export function buildTouchFileCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `touch ${fullPath}`);
}

export function buildMkdirCommand(containerName: string, dir: string): string {
  return fileOpExec(containerName, `mkdir -p ${dir}`);
}

export function buildRemoveFileCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `rm ${fullPath}`);
}

export function buildRemoveFolderCommand(containerName: string, fullPath: string): string {
  return fileOpExec(containerName, `rm -rf ${fullPath}`);
}
