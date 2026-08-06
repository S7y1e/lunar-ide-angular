pub(super) fn is_ident_start(c: u8) -> bool {
    c.is_ascii_alphabetic() || c == b'_'
}

pub(super) fn is_ident_part(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

pub(super) fn long_bracket_level(b: &[u8], i: usize) -> Option<usize> {
    if b.get(i) != Some(&b'[') {
        return None;
    }
    let mut j = i + 1;
    let mut eq = 0;
    while b.get(j) == Some(&b'=') {
        eq += 1;
        j += 1;
    }
    if b.get(j) == Some(&b'[') {
        Some(eq)
    } else {
        None
    }
}

fn closes_long_bracket(b: &[u8], j: usize, level: usize) -> bool {
    if b.get(j) != Some(&b']') {
        return false;
    }
    for k in 0..level {
        if b.get(j + 1 + k) != Some(&b'=') {
            return false;
        }
    }
    b.get(j + 1 + level) == Some(&b']')
}

pub(super) fn skip_long_bracket(b: &[u8], i: usize, level: usize) -> usize {
    let mut j = i + 2 + level;
    while j < b.len() {
        if closes_long_bracket(b, j, level) {
            return j + level + 2;
        }
        j += 1;
    }
    b.len()
}

pub(super) fn read_quoted(b: &[u8], start: usize, quote: u8) -> (String, usize) {
    let mut i = start + 1;
    let mut bytes = Vec::new();
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            if i + 1 < b.len() {
                bytes.push(b[i + 1]);
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }
        if c == quote {
            i += 1;
            break;
        }
        bytes.push(c);
        i += 1;
    }
    (String::from_utf8_lossy(&bytes).into_owned(), i)
}
