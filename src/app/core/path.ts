const SEP = /[\\/]/;

export const baseName = (path: string): string => path.split(SEP).pop() || path;

export const pathSegments = (path: string): string[] => path.split(SEP).filter(Boolean);

// Absolute path -> project-relative, "/"-separated (matches what Rust-side
// project scans (dependencies, todos, search) report paths as).
export const toRelative = (root: string, absPath: string): string => {
    // Comparing by prefix alone would count a sibling directory as inside the
    // root — "/home/u/game" against "/home/u/game-assets/x" — and slice the
    // name apart. What follows the root has to be a separator, or nothing.
    const base = root.replace(/[\\/]+$/, '');
    const inside = absPath === base || (absPath.startsWith(base) && SEP.test(absPath[base.length]));
    const rel = inside ? absPath.slice(base.length) : absPath;
    return rel.replace(/^[\\/]+/, '').replace(/\\/g, '/');
};
