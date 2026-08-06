const SEP = /[\\/]/;

export const baseName = (path: string): string => path.split(SEP).pop() || path;

export const pathSegments = (path: string): string[] => path.split(SEP).filter(Boolean);

// Absolute path -> project-relative, "/"-separated (matches what Rust-side
// project scans (dependencies, todos, search) report paths as).
export const toRelative = (root: string, absPath: string): string => {
    const rel = absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
    return rel.replace(/^[\\/]+/, '').replace(/\\/g, '/');
};
