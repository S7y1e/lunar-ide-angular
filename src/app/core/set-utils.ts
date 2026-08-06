// Immutable Set helpers: each returns a new Set so a signal .set() sees a
// changed reference, instead of hand-rolling "copy, mutate, return" at every
// call site.

export function toggleInSet<T>(set: Set<T>, item: T): Set<T> {
    const next = new Set(set);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    return next;
}

export function withAdded<T>(set: Set<T>, items: Iterable<T>): Set<T> {
    const next = new Set(set);
    for (const item of items) next.add(item);
    return next;
}

export function withRemoved<T>(set: Set<T>, items: Iterable<T>): Set<T> {
    const next = new Set(set);
    for (const item of items) next.delete(item);
    return next;
}

// Toggles each item independently (unlike withAdded/withRemoved, which apply
// the same operation to every item).
export function toggleAllInSet<T>(set: Set<T>, items: Iterable<T>): Set<T> {
    const next = new Set(set);
    for (const item of items) {
        if (next.has(item)) next.delete(item);
        else next.add(item);
    }
    return next;
}
