use super::lex_util::{
    is_ident_part, is_ident_start, long_bracket_level, read_quoted, skip_long_bracket,
};

#[derive(Debug, Clone, PartialEq)]
pub(super) enum Tok {
    Ident(String),
    Str(String),
    Local,
    Dot,
    Colon,
    LParen,
    RParen,
    Comma,
    Equal,
    Other,
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Token {
    pub kind: Tok,
    pub start: usize,
    pub end: usize,
}

pub(super) enum ChainArg {
    Path(Vec<String>),
    Str(String),
}

fn alias_chain(s: &str) -> Option<ChainArg> {
    let rest = s.strip_prefix("@game/")?;
    let mut segs = vec!["game".to_string()];
    segs.extend(rest.split('/').map(str::to_string));
    Some(ChainArg::Path(segs))
}

pub(super) fn lex(src: &str) -> Vec<Tok> {
    lex_spanned(src).into_iter().map(|t| t.kind).collect()
}

pub(super) fn lex_spanned(src: &str) -> Vec<Token> {
    let b = src.as_bytes();
    let n = b.len();
    let mut i = 0;
    let mut out = Vec::new();
    let push = |out: &mut Vec<Token>, kind, start, end| out.push(Token { kind, start, end });

    while i < n {
        let c = b[i];
        let start = i;
        match c {
            b' ' | b'\t' | b'\r' | b'\n' => i += 1,
            b'-' if b.get(i + 1) == Some(&b'-') => {
                i += 2;
                if let Some(level) = long_bracket_level(b, i) {
                    i = skip_long_bracket(b, i, level);
                } else {
                    while i < n && b[i] != b'\n' {
                        i += 1;
                    }
                }
            }
            b'"' | b'\'' => {
                let (s, ni) = read_quoted(b, i, c);
                i = ni;
                push(&mut out, Tok::Str(s), start, i);
            }
            b'[' if long_bracket_level(b, i).is_some() => {
                let level = long_bracket_level(b, i).unwrap();
                let inner = i + 2 + level;
                let end = skip_long_bracket(b, i, level);
                let inner_end = end.saturating_sub(level + 2).max(inner);
                let s = String::from_utf8_lossy(&b[inner..inner_end]).into_owned();
                i = end;
                push(&mut out, Tok::Str(s), start, i);
            }
            b'.' => {
                i += 1;
                push(&mut out, Tok::Dot, start, i);
            }
            b':' => {
                i += 1;
                push(&mut out, Tok::Colon, start, i);
            }
            b'(' => {
                i += 1;
                push(&mut out, Tok::LParen, start, i);
            }
            b')' => {
                i += 1;
                push(&mut out, Tok::RParen, start, i);
            }
            b',' => {
                i += 1;
                push(&mut out, Tok::Comma, start, i);
            }
            b'=' => {
                if b.get(i + 1) == Some(&b'=') {
                    i += 2;
                    push(&mut out, Tok::Other, start, i);
                } else {
                    i += 1;
                    push(&mut out, Tok::Equal, start, i);
                }
            }
            _ if is_ident_start(c) => {
                i += 1;
                while i < n && is_ident_part(b[i]) {
                    i += 1;
                }
                let s = &src[start..i];
                let kind = if s == "local" {
                    Tok::Local
                } else {
                    Tok::Ident(s.to_string())
                };
                push(&mut out, kind, start, i);
            }
            _ => {
                i += 1;
                push(&mut out, Tok::Other, start, i);
            }
        }
    }
    out
}

pub(super) fn parse_chain(tokens: &[Tok], i: usize) -> Option<ChainArg> {
    parse_chain_at(tokens, i).map(|(arg, _)| arg)
}

// Like parse_chain, but also returns the index one past the last consumed token,
// so callers with spans can locate the trailing segment's token.
pub(super) fn parse_chain_at(tokens: &[Tok], mut i: usize) -> Option<(ChainArg, usize)> {
    match tokens.get(i)? {
        Tok::Str(s) => Some((
            alias_chain(s).unwrap_or_else(|| ChainArg::Str(s.clone())),
            i + 1,
        )),
        Tok::Ident(name) => {
            let mut segs = vec![name.clone()];
            i += 1;
            loop {
                match tokens.get(i) {
                    Some(Tok::Dot) => match tokens.get(i + 1) {
                        Some(Tok::Ident(n)) => {
                            segs.push(n.clone());
                            i += 2;
                        }
                        _ => break,
                    },
                    Some(Tok::Colon) => {
                        if let (Some(Tok::Ident(m)), Some(Tok::LParen), Some(Tok::Str(arg))) =
                            (tokens.get(i + 1), tokens.get(i + 2), tokens.get(i + 3))
                        {
                            match m.as_str() {
                                "GetService" => segs = vec!["game".to_string(), arg.clone()],
                                // descend into the named child (the 2nd arg, a
                                // WaitForChild timeout / FindFirstChild recurse flag,
                                // is skipped by scanning to the closing paren).
                                "WaitForChild" | "FindFirstChild" => segs.push(arg.clone()),
                                _ => break,
                            }
                            match tokens.get(i + 4) {
                                Some(Tok::RParen) => {
                                    i += 5;
                                    continue;
                                }
                                Some(_) => {
                                    let mut j = i + 4;
                                    let mut depth = 1;
                                    while let Some(t) = tokens.get(j) {
                                        match t {
                                            Tok::LParen => depth += 1,
                                            Tok::RParen => {
                                                depth -= 1;
                                                if depth == 0 {
                                                    break;
                                                }
                                            }
                                            _ => {}
                                        }
                                        j += 1;
                                    }
                                    i = j + 1;
                                    continue;
                                }
                                None => break,
                            }
                        }
                        break;
                    }
                    _ => break,
                }
            }
            Some((ChainArg::Path(segs), i))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lex_unchanged_by_spans() {
        let src = "local x = require(game.A):B('s') -- c\n[[long]]";
        let kinds: Vec<Tok> = lex_spanned(src).into_iter().map(|t| t.kind).collect();
        assert_eq!(kinds, lex(src));
    }

    #[test]
    fn spans_slice_back_to_source() {
        let src = "local foo = require(\"pkg\")";
        for t in lex_spanned(src) {
            let slice = &src[t.start..t.end];
            match &t.kind {
                Tok::Local => assert_eq!(slice, "local"),
                Tok::Ident(n) => assert_eq!(slice, n),
                Tok::Equal => assert_eq!(slice, "="),
                Tok::LParen => assert_eq!(slice, "("),
                Tok::RParen => assert_eq!(slice, ")"),
                Tok::Str(_) => assert_eq!(slice, "\"pkg\""),
                _ => {}
            }
        }
    }

    fn path_of(src: &str) -> Vec<String> {
        let toks = lex(src);
        match parse_chain(&toks, 0) {
            Some(ChainArg::Path(segs)) => segs,
            _ => panic!("not a path chain"),
        }
    }

    #[test]
    fn chain_descends_through_waitforchild() {
        assert_eq!(
            path_of("Shared:WaitForChild(\"Hello\")"),
            vec!["Shared", "Hello"]
        );
        assert_eq!(
            path_of("game:GetService(\"ReplicatedStorage\"):WaitForChild(\"Shared\")"),
            vec!["game", "ReplicatedStorage", "Shared"]
        );
        // FindFirstChild + a trailing arg, then a dotted descent
        assert_eq!(
            path_of("root:FindFirstChild(\"A\", true).B"),
            vec!["root", "A", "B"]
        );
    }

    #[test]
    fn long_string_span_covers_brackets() {
        let src = "x = [[hi]]";
        let toks = lex_spanned(src);
        let s = toks.iter().find(|t| matches!(t.kind, Tok::Str(_))).unwrap();
        assert_eq!(&src[s.start..s.end], "[[hi]]");
        assert_eq!(s.kind, Tok::Str("hi".to_string()));
    }
}
