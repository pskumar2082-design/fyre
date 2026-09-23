var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@asamuzakjp/css-color/dist/esm/index.js
var index_exports = {};
__export(index_exports, {
  convert: () => ha,
  resolve: () => Tr,
  utils: () => ga
});
module.exports = __toCommonJS(index_exports);

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@csstools/css-tokenizer/dist/index.mjs
var ParseError = class extends Error {
  sourceStart;
  sourceEnd;
  parserState;
  constructor(e3, n3, t3, o3) {
    super(e3), this.name = "ParseError", this.sourceStart = n3, this.sourceEnd = t3, this.parserState = o3;
  }
};
var ParseErrorWithToken = class extends ParseError {
  token;
  constructor(e3, n3, t3, o3, r3) {
    super(e3, n3, t3, o3), this.token = r3;
  }
};
var e = { UnexpectedNewLineInString: "Unexpected newline while consuming a string token.", UnexpectedEOFInString: "Unexpected EOF while consuming a string token.", UnexpectedEOFInComment: "Unexpected EOF while consuming a comment.", UnexpectedEOFInURL: "Unexpected EOF while consuming a url token.", UnexpectedEOFInEscapedCodePoint: "Unexpected EOF while consuming an escaped code point.", UnexpectedCharacterInURL: "Unexpected character while consuming a url token.", InvalidEscapeSequenceInURL: "Invalid escape sequence while consuming a url token.", InvalidEscapeSequenceAfterBackslash: 'Invalid escape sequence after "\\"' };
var n = "undefined" != typeof globalThis && "structuredClone" in globalThis;
function stringify(...e3) {
  let n3 = "";
  for (let t3 = 0; t3 < e3.length; t3++) n3 += e3[t3][1];
  return n3;
}
var t = 13;
var o = 45;
var r = 10;
var i = 43;
var c = 65533;
var s = 92;
var u;
var a;
var d;
function mirrorVariantType(e3) {
  switch (e3) {
    case u.OpenParen:
      return u.CloseParen;
    case u.CloseParen:
      return u.OpenParen;
    case u.OpenCurly:
      return u.CloseCurly;
    case u.CloseCurly:
      return u.OpenCurly;
    case u.OpenSquare:
      return u.CloseSquare;
    case u.CloseSquare:
      return u.OpenSquare;
    default:
      return null;
  }
}
function mirrorVariant(e3) {
  switch (e3[0]) {
    case u.OpenParen:
      return [u.CloseParen, ")", -1, -1, void 0];
    case u.CloseParen:
      return [u.OpenParen, "(", -1, -1, void 0];
    case u.OpenCurly:
      return [u.CloseCurly, "}", -1, -1, void 0];
    case u.CloseCurly:
      return [u.OpenCurly, "{", -1, -1, void 0];
    case u.OpenSquare:
      return [u.CloseSquare, "]", -1, -1, void 0];
    case u.CloseSquare:
      return [u.OpenSquare, "[", -1, -1, void 0];
    default:
      return null;
  }
}
function isHexDigitCodePoint(e3) {
  return e3 >= 48 && e3 <= 57 || e3 >= 97 && e3 <= 102 || e3 >= 65 && e3 <= 70;
}
function isIdentStartCodePoint(e3) {
  return e3 >= 97 && e3 <= 122 || e3 >= 65 && e3 <= 90 || 95 === e3 || isNonASCII_IdentCodePoint(e3);
}
function isIdentCodePoint(e3) {
  return e3 >= 97 && e3 <= 122 || e3 >= 65 && e3 <= 90 || e3 >= 48 && e3 <= 57 || e3 === o || 95 === e3 || isNonASCII_IdentCodePoint(e3);
}
function isNonASCII_IdentCodePoint(e3) {
  return e3 < 183 ? 0 === e3 : 183 === e3 || 8204 === e3 || 8205 === e3 || 8255 === e3 || 8256 === e3 || 8204 === e3 || (192 <= e3 && e3 <= 214 || 216 <= e3 && e3 <= 246 || 248 <= e3 && e3 <= 893 || 895 <= e3 && e3 <= 8191 || 8304 <= e3 && e3 <= 8591 || 11264 <= e3 && e3 <= 12271 || 12289 <= e3 && e3 <= 55295 || 63744 <= e3 && e3 <= 64975 || 65008 <= e3 && e3 <= 65533 || (0 === e3 || (e3 >= 55296 && e3 <= 57343 || e3 >= 65536)));
}
function isNonPrintableCodePoint(e3) {
  return 11 === e3 || 127 === e3 || 0 <= e3 && e3 <= 8 || 14 <= e3 && e3 <= 31;
}
function isNewLine(e3) {
  return e3 === r || e3 === t || 12 === e3;
}
function isWhitespace(e3) {
  return 32 === e3 || e3 === r || 9 === e3 || e3 === t || 12 === e3;
}
function isSurrogate(e3) {
  return e3 >= 55296 && e3 <= 57343;
}
function tokenize(e3, n3) {
  const t3 = tokenizer(e3, n3), o3 = [];
  for (; !t3.endOfFile(); ) o3.push(t3.nextToken());
  return o3.push(t3.nextToken()), o3;
}
function tokenizer(n3, C3) {
  const l3 = n3.css.valueOf(), f4 = n3.unicodeRangesAllowed ?? false;
  let m3 = 0, h3 = 0, k4 = -1, P4 = false;
  const p2 = C3?.onParseError ?? noop;
  function consumeIdentSequence() {
    const e3 = m3;
    for (; ; ) {
      const e4 = l3.charCodeAt(m3);
      if (e4 >= 65 && e4 <= 90 || e4 >= 97 && e4 <= 122 || e4 >= 48 && e4 <= 57 || e4 === o || 95 === e4) {
        m3 += 1;
        continue;
      }
      const n5 = l3.codePointAt(m3) ?? -1;
      if (0 === n5 || n5 >= 55296 && n5 <= 57343 || n5 === s && !isNewLine(l3.codePointAt(m3 + 1) ?? -1)) break;
      if (!isNonASCII_IdentCodePoint(n5)) break;
      m3 += +(n5 > 65535) + 1;
    }
    const n4 = l3.codePointAt(m3) ?? -1;
    if (0 !== n4 && !(n4 >= 55296 && n4 <= 57343) && (n4 !== s || isNewLine(l3.codePointAt(m3 + 1) ?? -1))) return P4 = true, k4 = m3 - 1, l3.slice(e3, m3);
    P4 = false, m3 = e3, k4 = -1;
    let t3 = "";
    for (; ; ) {
      const e4 = l3.codePointAt(m3) ?? -1;
      if (0 === e4 || isSurrogate(e4)) t3 += String.fromCharCode(c), m3 += +(e4 > 65535) + 1, k4 = m3 - 1;
      else if (e4 >= 65 && e4 <= 90 || e4 >= 97 && e4 <= 122 || e4 >= 48 && e4 <= 57 || e4 === o || 95 === e4 || isNonASCII_IdentCodePoint(e4)) t3 += e4 > 65535 ? String.fromCodePoint(e4) : String.fromCharCode(e4), m3 += +(e4 > 65535) + 1, k4 = m3 - 1;
      else {
        if (l3.codePointAt(m3) !== s || isNewLine(l3.codePointAt(m3 + 1) ?? -1)) return t3;
        m3 += 1, k4 = m3 - 1, t3 += String.fromCodePoint(consumeEscapedCodePoint());
      }
    }
  }
  function consumeEscapedCodePoint() {
    const n4 = l3.codePointAt(m3);
    if (void 0 === n4) return p2(new ParseError(e.UnexpectedEOFInEscapedCodePoint, h3, k4, ["4.3.7. Consume an escaped code point", "Unexpected EOF"])), c;
    if (m3 += +(n4 > 65535) + 1, k4 = m3 - 1, isHexDigitCodePoint(n4)) {
      const e3 = [n4];
      let o3;
      for (; void 0 !== (o3 = l3.codePointAt(m3)) && isHexDigitCodePoint(o3) && e3.length < 6; ) e3.push(o3), m3 += 1, k4 = m3 - 1;
      isWhitespace(l3.codePointAt(m3) ?? -1) && (l3.codePointAt(m3) === t && l3.codePointAt(m3 + 1) === r && (m3 += 1), m3 += 1, k4 = m3 - 1);
      const i3 = parseInt(String.fromCodePoint(...e3), 16);
      return 0 === i3 || isSurrogate(i3) || i3 > 1114111 ? c : i3;
    }
    return 0 === n4 || isSurrogate(n4) ? c : n4;
  }
  function consumeBadURL() {
    for (; ; ) {
      const e3 = l3.codePointAt(m3);
      if (void 0 === e3) return;
      if (41 === e3) return m3 += 1, void (k4 = m3 - 1);
      e3 !== s || isNewLine(l3.codePointAt(m3 + 1) ?? -1) ? (m3 += 1, k4 = m3 - 1) : (m3 += 1, k4 = m3 - 1, consumeEscapedCodePoint());
    }
  }
  function consumeComment2() {
    for (m3 += 2, k4 = m3 - 1; ; ) {
      const n4 = l3.codePointAt(m3);
      if (void 0 === n4) {
        const n5 = [u.Comment, l3.slice(h3, k4 + 1), h3, k4, void 0];
        return p2(new ParseErrorWithToken(e.UnexpectedEOFInComment, h3, k4, ["4.3.2. Consume comments", "Unexpected EOF"], n5)), n5;
      }
      if (m3 += 1, k4 = m3 - 1, 42 === n4 && void 0 !== l3.codePointAt(m3) && 47 === l3.codePointAt(m3)) {
        m3 += 1, k4 = m3 - 1;
        break;
      }
    }
    return [u.Comment, l3.slice(h3, k4 + 1), h3, k4, void 0];
  }
  function consumeStringToken() {
    let n4 = "";
    const o3 = l3.codePointAt(m3);
    for (m3 += 1, k4 = m3 - 1; ; ) {
      const i3 = l3.charCodeAt(m3);
      if (m3 >= l3.length) {
        const t3 = [u.String, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }];
        return p2(new ParseErrorWithToken(e.UnexpectedEOFInString, h3, k4, ["4.3.5. Consume a string token", "Unexpected EOF"], t3)), t3;
      }
      if (m3 += 1, k4 = m3 - 1, isNewLine(i3)) {
        m3 -= 1, k4 = m3 - 1;
        const n5 = [u.BadString, l3.slice(h3, k4 + 1), h3, k4, void 0];
        return p2(new ParseErrorWithToken(e.UnexpectedNewLineInString, h3, l3.codePointAt(m3) === t && l3.codePointAt(m3 + 1) === r ? k4 + 2 : k4 + 1, ["4.3.5. Consume a string token", "Unexpected newline"], n5)), n5;
      }
      if (i3 === o3) return [u.String, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }];
      if (i3 !== s) if (0 !== i3) if (i3 < 128) n4 += String.fromCharCode(i3);
      else {
        if (i3 >= 55296 && i3 <= 57343) {
          const e3 = l3.codePointAt(m3 - 1) ?? -1;
          e3 >= 65536 ? (n4 += String.fromCodePoint(e3), m3 += 1, k4 = m3 - 1) : n4 += String.fromCharCode(c);
          continue;
        }
        n4 += String.fromCharCode(i3);
      }
      else n4 += String.fromCharCode(c);
      else {
        if (void 0 === l3.codePointAt(m3)) continue;
        if (isNewLine(l3.codePointAt(m3) ?? -1)) {
          l3.codePointAt(m3) === t && l3.codePointAt(m3 + 1) === r && (m3 += 1), m3 += 1, k4 = m3 - 1;
          continue;
        }
        n4 += String.fromCodePoint(consumeEscapedCodePoint());
      }
    }
  }
  function consumeUnicodeRangeToken() {
    m3 += 2, k4 = m3 - 1;
    const e3 = [], n4 = [];
    let t3;
    for (; void 0 !== (t3 = l3.codePointAt(m3)) && e3.length < 6 && isHexDigitCodePoint(t3); ) e3.push(t3), m3 += 1, k4 = m3 - 1;
    for (; void 0 !== (t3 = l3.codePointAt(m3)) && e3.length < 6 && 63 === t3; ) 0 === n4.length && n4.push(...e3), e3.push(48), n4.push(70), m3 += 1, k4 = m3 - 1;
    if (!n4.length && l3.codePointAt(m3) === o && isHexDigitCodePoint(l3.codePointAt(m3 + 1) ?? -1)) for (m3 += 1, k4 = m3 - 1; void 0 !== (t3 = l3.codePointAt(m3)) && n4.length < 6 && isHexDigitCodePoint(t3); ) n4.push(t3), m3 += 1, k4 = m3 - 1;
    if (!n4.length) {
      const n5 = parseInt(String.fromCodePoint(...e3), 16);
      return [u.UnicodeRange, l3.slice(h3, k4 + 1), h3, k4, { startOfRange: n5, endOfRange: n5 }];
    }
    const r3 = parseInt(String.fromCodePoint(...e3), 16), i3 = parseInt(String.fromCodePoint(...n4), 16);
    return [u.UnicodeRange, l3.slice(h3, k4 + 1), h3, k4, { startOfRange: r3, endOfRange: i3 }];
  }
  function consumeUrlToken() {
    for (; isWhitespace(l3.codePointAt(m3) ?? -1); ) m3 += 1, k4 = m3 - 1;
    let n4 = "";
    for (; ; ) {
      if (void 0 === l3.codePointAt(m3)) {
        const t4 = [u.URL, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }];
        return p2(new ParseErrorWithToken(e.UnexpectedEOFInURL, h3, k4, ["4.3.6. Consume a url token", "Unexpected EOF"], t4)), t4;
      }
      if (41 === l3.codePointAt(m3)) return m3 += 1, k4 = m3 - 1, [u.URL, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }];
      if (isWhitespace(l3.codePointAt(m3) ?? -1)) {
        for (m3 += 1, k4 = m3 - 1; isWhitespace(l3.codePointAt(m3) ?? -1); ) m3 += 1, k4 = m3 - 1;
        if (void 0 === l3.codePointAt(m3)) {
          const t4 = [u.URL, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }];
          return p2(new ParseErrorWithToken(e.UnexpectedEOFInURL, h3, k4, ["4.3.6. Consume a url token", "Consume as much whitespace as possible", "Unexpected EOF"], t4)), t4;
        }
        return 41 === l3.codePointAt(m3) ? (m3 += 1, k4 = m3 - 1, [u.URL, l3.slice(h3, k4 + 1), h3, k4, { value: n4 }]) : (consumeBadURL(), [u.BadURL, l3.slice(h3, k4 + 1), h3, k4, void 0]);
      }
      const t3 = l3.codePointAt(m3);
      if (34 === t3 || 39 === t3 || 40 === t3 || isNonPrintableCodePoint(t3 ?? -1)) {
        consumeBadURL();
        const n5 = [u.BadURL, l3.slice(h3, k4 + 1), h3, k4, void 0];
        return p2(new ParseErrorWithToken(e.UnexpectedCharacterInURL, h3, k4, ["4.3.6. Consume a url token", `Unexpected U+0022 QUOTATION MARK ("), U+0027 APOSTROPHE ('), U+0028 LEFT PARENTHESIS (() or non-printable code point`], n5)), n5;
      }
      if (t3 === s) {
        if (t3 === s && !isNewLine(l3.codePointAt(m3 + 1) ?? -1)) {
          m3 += 1, k4 = m3 - 1, n4 += String.fromCodePoint(consumeEscapedCodePoint());
          continue;
        }
        consumeBadURL();
        const o3 = [u.BadURL, l3.slice(h3, k4 + 1), h3, k4, void 0];
        return p2(new ParseErrorWithToken(e.InvalidEscapeSequenceInURL, h3, k4, ["4.3.6. Consume a url token", "U+005C REVERSE SOLIDUS (\\)", "The input stream does not start with a valid escape sequence"], o3)), o3;
      }
      0 === t3 || isSurrogate(t3 ?? -1) ? (n4 += String.fromCharCode(c), m3 += 1, k4 = m3 - 1) : (n4 += String.fromCodePoint(t3 ?? c), m3 += +((t3 ?? -1) > 65535) + 1, k4 = m3 - 1);
    }
  }
  function consumeNumericToken() {
    let e3;
    {
      const n5 = l3.charCodeAt(m3);
      n5 === o ? e3 = "-" : n5 === i && (e3 = "+");
    }
    let n4 = a.Integer;
    const t3 = l3.charCodeAt(m3);
    t3 !== i && t3 !== o || (m3 += 1);
    let r3 = l3.charCodeAt(m3);
    for (; r3 >= 48 && r3 <= 57; ) m3 += 1, r3 = l3.charCodeAt(m3);
    if (46 === l3.charCodeAt(m3) && l3.charCodeAt(m3 + 1) >= 48 && l3.charCodeAt(m3 + 1) <= 57) for (m3 += 2, n4 = a.Number, r3 = l3.charCodeAt(m3); r3 >= 48 && r3 <= 57; ) m3 += 1, r3 = l3.charCodeAt(m3);
    const c4 = l3.charCodeAt(m3);
    if (101 === c4 || 69 === c4) {
      const e4 = l3.charCodeAt(m3 + 1);
      if (e4 >= 48 && e4 <= 57) for (m3 += 2, n4 = a.Number, r3 = l3.charCodeAt(m3); r3 >= 48 && r3 <= 57; ) m3 += 1, r3 = l3.charCodeAt(m3);
      else if ((e4 === o || e4 === i) && l3.charCodeAt(m3 + 2) >= 48 && l3.charCodeAt(m3 + 2) <= 57) for (m3 += 3, n4 = a.Number, r3 = l3.charCodeAt(m3); r3 >= 48 && r3 <= 57; ) m3 += 1, r3 = l3.charCodeAt(m3);
    }
    k4 = m3 - 1;
    const s4 = parseFloat(l3.slice(h3, k4 + 1));
    if (checkIfThreeCodePointsWouldStartAnIdentSequence()) {
      const t4 = consumeIdentSequence();
      return [u.Dimension, l3.slice(h3, k4 + 1), h3, k4, { value: s4, signCharacter: e3, type: n4, unit: t4 }];
    }
    return 37 === l3.charCodeAt(m3) ? (m3 += 1, k4 = m3 - 1, [u.Percentage, l3.slice(h3, k4 + 1), h3, k4, { value: s4, signCharacter: e3 }]) : [u.Number, l3.slice(h3, k4 + 1), h3, k4, { value: s4, signCharacter: e3, type: n4 }];
  }
  function consumeIdentLikeToken() {
    const e3 = consumeIdentSequence();
    if (40 !== l3.charCodeAt(m3)) return [u.Ident, P4 ? e3 : l3.slice(h3, k4 + 1), h3, k4, { value: e3 }];
    if (!(3 !== e3.length || 117 !== e3.charCodeAt(0) && 85 !== e3.charCodeAt(0) || 114 !== e3.charCodeAt(1) && 82 !== e3.charCodeAt(1) || 108 !== e3.charCodeAt(2) && 76 !== e3.charCodeAt(2))) {
      m3 += 1, k4 = m3 - 1;
      let n4 = 0;
      for (; isWhitespace(l3.charCodeAt(m3)); ) n4 += 1, m3 += 1, k4 = m3 - 1;
      const t3 = l3.charCodeAt(m3);
      return 34 === t3 || 39 === t3 ? (n4 > 0 && (m3 -= n4, k4 = m3 - 1), [u.Function, l3.slice(h3, k4 + 1), h3, k4, { value: e3 }]) : consumeUrlToken();
    }
    return m3 += 1, k4 = m3 - 1, [u.Function, l3.slice(h3, k4 + 1), h3, k4, { value: e3 }];
  }
  function consumeHashToken() {
    m3 += 1, k4 = m3 - 1;
    const e3 = l3.charCodeAt(m3);
    if (e3 >= 65 && e3 <= 90 || e3 >= 97 && e3 <= 122 || e3 >= 48 && e3 <= 57 || e3 === o || 95 === e3 || isNonASCII_IdentCodePoint(e3) || e3 === s && !isNewLine(l3.codePointAt(m3 + 1) ?? -1)) {
      let e4 = d.Unrestricted;
      checkIfThreeCodePointsWouldStartAnIdentSequence() && (e4 = d.ID);
      const n4 = consumeIdentSequence();
      return [u.Hash, l3.slice(h3, k4 + 1), h3, k4, { value: n4, type: e4 }];
    }
    return [u.Delim, "#", h3, k4, { value: "#" }];
  }
  function consumeAtKeywordToken() {
    if (m3 += 1, k4 = m3 - 1, checkIfThreeCodePointsWouldStartAnIdentSequence()) {
      const e3 = consumeIdentSequence();
      return [u.AtKeyword, l3.slice(h3, k4 + 1), h3, k4, { value: e3 }];
    }
    return [u.Delim, "@", h3, k4, { value: "@" }];
  }
  function consumeInvalidEscapeToken() {
    m3 += 1, k4 = m3 - 1;
    const n4 = [u.Delim, "\\", h3, k4, { value: "\\" }];
    return p2(new ParseErrorWithToken(e.InvalidEscapeSequenceAfterBackslash, h3, k4, ["4.3.1. Consume a token", "U+005C REVERSE SOLIDUS (\\)", "The input stream does not start with a valid escape sequence"], n4)), n4;
  }
  function checkIfThreeCodePointsWouldStartAnIdentSequence(e3) {
    const n4 = void 0 === e3 ? l3.charCodeAt(m3) : e3;
    return n4 === o ? l3.charCodeAt(m3 + 1) === o || (!!isIdentStartCodePoint(l3.charCodeAt(m3 + 1)) || l3.charCodeAt(m3 + 1) === s && !isNewLine(l3.charCodeAt(m3 + 2))) : !!isIdentStartCodePoint(n4) || l3.charCodeAt(m3) === s && !isNewLine(l3.charCodeAt(m3 + 1));
  }
  function checkIfThreeCodePointsWouldStartANumber(e3) {
    return e3 === i || e3 === o ? l3.charCodeAt(m3 + 1) >= 48 && l3.charCodeAt(m3 + 1) <= 57 || 46 === l3.charCodeAt(m3 + 1) && (l3.charCodeAt(m3 + 2) >= 48 && l3.charCodeAt(m3 + 2) <= 57) : 46 === e3 ? l3.charCodeAt(m3 + 1) >= 48 && l3.charCodeAt(m3 + 1) <= 57 : e3 >= 48 && e3 <= 57;
  }
  return { nextToken: function nextToken() {
    if (h3 = m3, k4 = -1, m3 >= l3.length) return [u.EOF, "", -1, -1, void 0];
    const e3 = l3.charCodeAt(m3);
    if (47 === e3 && 42 === l3.charCodeAt(m3 + 1)) return consumeComment2();
    if (f4 && (117 === e3 || 85 === e3) && l3.codePointAt(m3 + 1) === i && (63 === l3.codePointAt(m3 + 2) || isHexDigitCodePoint(l3.codePointAt(m3 + 2) ?? -1))) return consumeUnicodeRangeToken();
    if (isIdentStartCodePoint(e3)) return consumeIdentLikeToken();
    if ((n4 = e3) >= 48 && n4 <= 57) return consumeNumericToken();
    switch (e3) {
      case 44:
        return m3 += 1, k4 = m3 - 1, [u.Comma, ",", h3, k4, void 0];
      case 58:
        return m3 += 1, k4 = m3 - 1, [u.Colon, ":", h3, k4, void 0];
      case 59:
        return m3 += 1, k4 = m3 - 1, [u.Semicolon, ";", h3, k4, void 0];
      case 40:
        return m3 += 1, k4 = m3 - 1, [u.OpenParen, "(", h3, k4, void 0];
      case 41:
        return m3 += 1, k4 = m3 - 1, [u.CloseParen, ")", h3, k4, void 0];
      case 91:
        return m3 += 1, k4 = m3 - 1, [u.OpenSquare, "[", h3, k4, void 0];
      case 93:
        return m3 += 1, k4 = m3 - 1, [u.CloseSquare, "]", h3, k4, void 0];
      case 123:
        return m3 += 1, k4 = m3 - 1, [u.OpenCurly, "{", h3, k4, void 0];
      case 125:
        return m3 += 1, k4 = m3 - 1, [u.CloseCurly, "}", h3, k4, void 0];
      case 39:
      case 34:
        return consumeStringToken();
      case 35:
        return consumeHashToken();
      case i:
      case 46:
        return checkIfThreeCodePointsWouldStartANumber(e3) ? consumeNumericToken() : (m3 += 1, k4 = m3 - 1, [u.Delim, l3[h3], h3, k4, { value: l3[h3] }]);
      case r:
      case t:
      case 12:
      case 9:
      case 32:
        {
          let e4 = l3.charCodeAt(m3);
          for (; 32 === e4 || e4 === r || 9 === e4 || e4 === t || 12 === e4; ) m3 += 1, e4 = l3.charCodeAt(m3);
          k4 = m3 - 1;
        }
        return [u.Whitespace, l3.slice(h3, k4 + 1), h3, k4, void 0];
      case o:
        return checkIfThreeCodePointsWouldStartANumber(e3) ? consumeNumericToken() : l3.charCodeAt(m3 + 1) === o && 62 === l3.charCodeAt(m3 + 2) ? (m3 += 3, k4 = m3 - 1, [u.CDC, "-->", h3, k4, void 0]) : checkIfThreeCodePointsWouldStartAnIdentSequence(e3) ? consumeIdentLikeToken() : (m3 += 1, k4 = m3 - 1, [u.Delim, "-", h3, k4, { value: "-" }]);
      case 60:
        return 33 === l3.charCodeAt(m3 + 1) && l3.charCodeAt(m3 + 2) === o && l3.charCodeAt(m3 + 3) === o ? (m3 += 4, k4 = m3 - 1, [u.CDO, "<!--", h3, k4, void 0]) : (m3 += 1, k4 = m3 - 1, [u.Delim, "<", h3, k4, { value: "<" }]);
      case 64:
        return consumeAtKeywordToken();
      case s:
        return e3 !== s || isNewLine(l3.charCodeAt(m3 + 1)) ? consumeInvalidEscapeToken() : consumeIdentLikeToken();
      default:
        return m3 += 1, k4 = m3 - 1, [u.Delim, l3[h3], h3, k4, { value: l3[h3] }];
    }
    var n4;
  }, endOfFile: function endOfFile() {
    return m3 >= l3.length;
  } };
}
function noop() {
}
function mutateUnit(e3, n3) {
  const t3 = [];
  for (const e4 of n3) t3.push(e4.codePointAt(0));
  const o3 = serializeIdent(t3);
  101 === o3[0] && insertEscapedCodePoint(o3, 0, o3[0]);
  const r3 = String.fromCodePoint(...o3), i3 = "+" === e3[4].signCharacter ? e3[4].signCharacter : "", c4 = e3[4].value.toString();
  e3[1] = `${i3}${c4}${r3}`, e3[4].unit = n3;
}
function serializeIdent(e3) {
  let n3;
  if (0 === e3[0]) e3.splice(0, 1, c), n3 = 1;
  else if (e3[0] === o && e3[1] === o) n3 = 2;
  else if (e3[0] === o && e3[1]) n3 = 2, isIdentStartCodePoint(e3[1]) || (n3 += insertEscapedCodePoint(e3, 1, e3[1]));
  else {
    if (e3[0] === o && !e3[1]) return [92, e3[0]];
    isIdentStartCodePoint(e3[0]) ? n3 = 1 : (n3 = 1, n3 += insertEscapedCodePoint(e3, 0, e3[0]));
  }
  for (let t3 = n3; t3 < e3.length; t3++) 0 !== e3[t3] ? isIdentCodePoint(e3[t3]) || (t3 += insertEscapedCharacter(e3, t3, e3[t3])) : (e3.splice(t3, 1, c), t3++);
  return e3;
}
function insertEscapedCharacter(e3, n3, t3) {
  return e3.splice(n3, 1, 92, t3), 1;
}
function insertEscapedCodePoint(e3, n3, t3) {
  const o3 = t3.toString(16), r3 = [];
  for (const e4 of o3) r3.push(e4.codePointAt(0));
  return e3.splice(n3, 1, 92, ...r3, 32), 1 + r3.length;
}
!(function(e3) {
  e3.Comment = "comment", e3.AtKeyword = "at-keyword-token", e3.BadString = "bad-string-token", e3.BadURL = "bad-url-token", e3.CDC = "CDC-token", e3.CDO = "CDO-token", e3.Colon = "colon-token", e3.Comma = "comma-token", e3.Delim = "delim-token", e3.Dimension = "dimension-token", e3.EOF = "EOF-token", e3.Function = "function-token", e3.Hash = "hash-token", e3.Ident = "ident-token", e3.Number = "number-token", e3.Percentage = "percentage-token", e3.Semicolon = "semicolon-token", e3.String = "string-token", e3.URL = "url-token", e3.Whitespace = "whitespace-token", e3.OpenParen = "(-token", e3.CloseParen = ")-token", e3.OpenSquare = "[-token", e3.CloseSquare = "]-token", e3.OpenCurly = "{-token", e3.CloseCurly = "}-token", e3.UnicodeRange = "unicode-range-token";
})(u || (u = {})), (function(e3) {
  e3.Integer = "integer", e3.Number = "number";
})(a || (a = {})), (function(e3) {
  e3.Unrestricted = "unrestricted", e3.ID = "id";
})(d || (d = {}));
var C = Object.values(u);
function isToken(e3) {
  return !!Array.isArray(e3) && (!(e3.length < 4) && (!!C.includes(e3[0]) && ("string" == typeof e3[1] && ("number" == typeof e3[2] && "number" == typeof e3[3]))));
}
function isTokenNumeric(e3) {
  if (!e3) return false;
  switch (e3[0]) {
    case u.Dimension:
    case u.Number:
    case u.Percentage:
      return true;
    default:
      return false;
  }
}
function isTokenWhiteSpaceOrComment(e3) {
  if (!e3) return false;
  switch (e3[0]) {
    case u.Whitespace:
    case u.Comment:
      return true;
    default:
      return false;
  }
}
function isTokenColon(e3) {
  return !!e3 && e3[0] === u.Colon;
}
function isTokenComma(e3) {
  return !!e3 && e3[0] === u.Comma;
}
function isTokenComment(e3) {
  return !!e3 && e3[0] === u.Comment;
}
function isTokenDelim(e3) {
  return !!e3 && e3[0] === u.Delim;
}
function isTokenDimension(e3) {
  return !!e3 && e3[0] === u.Dimension;
}
function isTokenEOF(e3) {
  return !!e3 && e3[0] === u.EOF;
}
function isTokenFunction(e3) {
  return !!e3 && e3[0] === u.Function;
}
function isTokenHash(e3) {
  return !!e3 && e3[0] === u.Hash;
}
function isTokenIdent(e3) {
  return !!e3 && e3[0] === u.Ident;
}
function isTokenNumber(e3) {
  return !!e3 && e3[0] === u.Number;
}
function isTokenPercentage(e3) {
  return !!e3 && e3[0] === u.Percentage;
}
function isTokenSemicolon(e3) {
  return !!e3 && e3[0] === u.Semicolon;
}
function isTokenWhitespace(e3) {
  return !!e3 && e3[0] === u.Whitespace;
}
function isTokenOpenParen(e3) {
  return !!e3 && e3[0] === u.OpenParen;
}
function isTokenCloseParen(e3) {
  return !!e3 && e3[0] === u.CloseParen;
}
function isTokenOpenSquare(e3) {
  return !!e3 && e3[0] === u.OpenSquare;
}
function isTokenOpenCurly(e3) {
  return !!e3 && e3[0] === u.OpenCurly;
}

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@csstools/css-parser-algorithms/dist/index.mjs
var f;
function walkerIndexGenerator(e3) {
  let n3 = e3.slice();
  return (e4, t3, o3) => {
    let s4 = -1;
    for (let i3 = n3.indexOf(t3); i3 < n3.length && (s4 = e4.indexOf(n3[i3]), -1 === s4 || s4 < o3); i3++) ;
    return -1 === s4 || s4 === o3 && t3 === e4[o3] && (s4++, s4 >= e4.length) ? -1 : (n3 = e4.slice(), s4);
  };
}
function consumeComponentValue(e3, n3) {
  const t3 = n3[0];
  if (isTokenOpenParen(t3) || isTokenOpenCurly(t3) || isTokenOpenSquare(t3)) {
    const t4 = consumeSimpleBlock(e3, n3);
    return { advance: t4.advance, node: t4.node };
  }
  if (isTokenFunction(t3)) {
    const t4 = consumeFunction(e3, n3);
    return { advance: t4.advance, node: t4.node };
  }
  if (isTokenWhitespace(t3)) {
    const t4 = consumeWhitespace(e3, n3);
    return { advance: t4.advance, node: t4.node };
  }
  if (isTokenComment(t3)) {
    const t4 = consumeComment(e3, n3);
    return { advance: t4.advance, node: t4.node };
  }
  return { advance: 1, node: new TokenNode(t3) };
}
!(function(e3) {
  e3.Function = "function", e3.SimpleBlock = "simple-block", e3.Whitespace = "whitespace", e3.Comment = "comment", e3.Token = "token";
})(f || (f = {}));
var ContainerNodeBaseClass = class {
  value = [];
  indexOf(e3) {
    return this.value.indexOf(e3);
  }
  at(e3) {
    if ("number" == typeof e3) return e3 < 0 && (e3 = this.value.length + e3), this.value[e3];
  }
  forEach(e3, n3) {
    if (0 === this.value.length) return;
    const t3 = walkerIndexGenerator(this.value);
    let o3 = 0;
    for (; o3 < this.value.length; ) {
      const s4 = this.value[o3];
      let i3;
      if (n3 && (i3 = { ...n3 }), false === e3({ node: s4, parent: this, state: i3 }, o3)) return false;
      if (o3 = t3(this.value, s4, o3), -1 === o3) break;
    }
  }
  walk(e3, n3) {
    0 !== this.value.length && this.forEach((n4, t3) => false !== e3(n4, t3) && ((!("walk" in n4.node) || !this.value.includes(n4.node) || false !== n4.node.walk(e3, n4.state)) && void 0), n3);
  }
};
var FunctionNode = class _FunctionNode extends ContainerNodeBaseClass {
  type = f.Function;
  name;
  endToken;
  constructor(e3, n3, t3) {
    super(), this.name = e3, this.endToken = n3, this.value = t3;
  }
  getName() {
    return this.name[4].value;
  }
  normalize() {
    isTokenEOF(this.endToken) && (this.endToken = [u.CloseParen, ")", -1, -1, void 0]);
  }
  tokens() {
    return isTokenEOF(this.endToken) ? [this.name, ...this.value.flatMap((e3) => e3.tokens())] : [this.name, ...this.value.flatMap((e3) => e3.tokens()), this.endToken];
  }
  toString() {
    const e3 = this.value.map((e4) => isToken(e4) ? stringify(e4) : e4.toString()).join("");
    return stringify(this.name) + e3 + stringify(this.endToken);
  }
  toJSON() {
    return { type: this.type, name: this.getName(), tokens: this.tokens(), value: this.value.map((e3) => e3.toJSON()) };
  }
  isFunctionNode() {
    return _FunctionNode.isFunctionNode(this);
  }
  static isFunctionNode(e3) {
    return !!e3 && (e3 instanceof _FunctionNode && e3.type === f.Function);
  }
};
function consumeFunction(n3, t3) {
  const o3 = [];
  let s4 = 1;
  for (; ; ) {
    const i3 = t3[s4];
    if (!i3 || isTokenEOF(i3)) return n3.onParseError(new ParseError("Unexpected EOF while consuming a function.", t3[0][2], t3[t3.length - 1][3], ["5.4.9. Consume a function", "Unexpected EOF"])), { advance: t3.length, node: new FunctionNode(t3[0], i3, o3) };
    if (isTokenCloseParen(i3)) return { advance: s4 + 1, node: new FunctionNode(t3[0], i3, o3) };
    if (isTokenWhiteSpaceOrComment(i3)) {
      const e3 = consumeAllCommentsAndWhitespace(n3, t3.slice(s4));
      s4 += e3.advance, o3.push(...e3.nodes);
      continue;
    }
    const r3 = consumeComponentValue(n3, t3.slice(s4));
    s4 += r3.advance, o3.push(r3.node);
  }
}
var SimpleBlockNode = class _SimpleBlockNode extends ContainerNodeBaseClass {
  type = f.SimpleBlock;
  startToken;
  endToken;
  constructor(e3, n3, t3) {
    super(), this.startToken = e3, this.endToken = n3, this.value = t3;
  }
  normalize() {
    if (isTokenEOF(this.endToken)) {
      const e3 = mirrorVariant(this.startToken);
      e3 && (this.endToken = e3);
    }
  }
  tokens() {
    return isTokenEOF(this.endToken) ? [this.startToken, ...this.value.flatMap((e3) => e3.tokens())] : [this.startToken, ...this.value.flatMap((e3) => e3.tokens()), this.endToken];
  }
  toString() {
    const e3 = this.value.map((e4) => isToken(e4) ? stringify(e4) : e4.toString()).join("");
    return stringify(this.startToken) + e3 + stringify(this.endToken);
  }
  toJSON() {
    return { type: this.type, startToken: this.startToken, tokens: this.tokens(), value: this.value.map((e3) => e3.toJSON()) };
  }
  isSimpleBlockNode() {
    return _SimpleBlockNode.isSimpleBlockNode(this);
  }
  static isSimpleBlockNode(e3) {
    return !!e3 && (e3 instanceof _SimpleBlockNode && e3.type === f.SimpleBlock);
  }
};
function consumeSimpleBlock(n3, t3) {
  const o3 = mirrorVariantType(t3[0][0]);
  if (!o3) throw new Error("Failed to parse, a mirror variant must exist for all block open tokens.");
  const s4 = [];
  let i3 = 1;
  for (; ; ) {
    const r3 = t3[i3];
    if (!r3 || isTokenEOF(r3)) return n3.onParseError(new ParseError("Unexpected EOF while consuming a simple block.", t3[0][2], t3[t3.length - 1][3], ["5.4.8. Consume a simple block", "Unexpected EOF"])), { advance: t3.length, node: new SimpleBlockNode(t3[0], r3, s4) };
    if (r3[0] === o3) return { advance: i3 + 1, node: new SimpleBlockNode(t3[0], r3, s4) };
    if (isTokenWhiteSpaceOrComment(r3)) {
      const e3 = consumeAllCommentsAndWhitespace(n3, t3.slice(i3));
      i3 += e3.advance, s4.push(...e3.nodes);
      continue;
    }
    const a3 = consumeComponentValue(n3, t3.slice(i3));
    i3 += a3.advance, s4.push(a3.node);
  }
}
var WhitespaceNode = class _WhitespaceNode {
  type = f.Whitespace;
  value;
  constructor(e3) {
    this.value = e3;
  }
  tokens() {
    return this.value;
  }
  toString() {
    return stringify(...this.value);
  }
  toJSON() {
    return { type: this.type, tokens: this.tokens() };
  }
  isWhitespaceNode() {
    return _WhitespaceNode.isWhitespaceNode(this);
  }
  static isWhitespaceNode(e3) {
    return !!e3 && (e3 instanceof _WhitespaceNode && e3.type === f.Whitespace);
  }
};
function consumeWhitespace(e3, n3) {
  let t3 = 0;
  for (; ; ) {
    const e4 = n3[t3];
    if (!isTokenWhitespace(e4)) return { advance: t3, node: new WhitespaceNode(n3.slice(0, t3)) };
    t3++;
  }
}
var CommentNode = class _CommentNode {
  type = f.Comment;
  value;
  constructor(e3) {
    this.value = e3;
  }
  tokens() {
    return [this.value];
  }
  toString() {
    return stringify(this.value);
  }
  toJSON() {
    return { type: this.type, tokens: this.tokens() };
  }
  isCommentNode() {
    return _CommentNode.isCommentNode(this);
  }
  static isCommentNode(e3) {
    return !!e3 && (e3 instanceof _CommentNode && e3.type === f.Comment);
  }
};
function consumeComment(e3, n3) {
  return { advance: 1, node: new CommentNode(n3[0]) };
}
function consumeAllCommentsAndWhitespace(e3, n3) {
  const t3 = [];
  let o3 = 0;
  for (; ; ) {
    if (isTokenWhitespace(n3[o3])) {
      const e4 = consumeWhitespace(0, n3.slice(o3));
      o3 += e4.advance, t3.push(e4.node);
      continue;
    }
    if (!isTokenComment(n3[o3])) return { advance: o3, nodes: t3 };
    t3.push(new CommentNode(n3[o3])), o3++;
  }
}
var TokenNode = class _TokenNode {
  type = f.Token;
  value;
  constructor(e3) {
    this.value = e3;
  }
  tokens() {
    return [this.value];
  }
  toString() {
    return this.value[1];
  }
  toJSON() {
    return { type: this.type, tokens: this.tokens() };
  }
  isTokenNode() {
    return _TokenNode.isTokenNode(this);
  }
  static isTokenNode(e3) {
    return !!e3 && (e3 instanceof _TokenNode && e3.type === f.Token);
  }
};
function parseComponentValue(t3, o3) {
  const s4 = { onParseError: o3?.onParseError ?? (() => {
  }) }, i3 = [...t3];
  isTokenEOF(i3[i3.length - 1]) || i3.push([u.EOF, "", i3[i3.length - 1][2], i3[i3.length - 1][3], void 0]);
  const r3 = consumeComponentValue(s4, i3);
  if (isTokenEOF(i3[Math.min(r3.advance, i3.length - 1)])) return r3.node;
  s4.onParseError(new ParseError("Expected EOF after parsing a component value.", t3[0][2], t3[t3.length - 1][3], ["5.3.9. Parse a component value", "Expected EOF"]));
}
function parseCommaSeparatedListOfComponentValues(t3, o3) {
  const s4 = { onParseError: o3?.onParseError ?? (() => {
  }) }, i3 = [...t3];
  if (0 === t3.length) return [];
  isTokenEOF(i3[i3.length - 1]) && i3.push([u.EOF, "", i3[i3.length - 1][2], i3[i3.length - 1][3], void 0]);
  const r3 = [];
  let a3 = [], c4 = 0;
  for (; ; ) {
    if (!i3[c4] || isTokenEOF(i3[c4])) return a3.length && r3.push(a3), r3;
    if (isTokenComma(i3[c4])) {
      r3.push(a3), a3 = [], c4++;
      continue;
    }
    const n3 = consumeComponentValue(s4, t3.slice(c4));
    a3.push(n3.node), c4 += n3.advance;
  }
}
function forEach(e3, n3, t3) {
  if (0 === e3.length) return;
  const o3 = walkerIndexGenerator(e3);
  let s4 = 0;
  for (; s4 < e3.length; ) {
    const i3 = e3[s4];
    let r3;
    if (t3 && (r3 = { ...t3 }), false === n3({ node: i3, parent: { value: e3 }, state: r3 }, s4)) return false;
    if (s4 = o3(e3, i3, s4), -1 === s4) break;
  }
}
function walk(e3, n3, t3) {
  0 !== e3.length && forEach(e3, (t4, o3) => false !== n3(t4, o3) && ((!("walk" in t4.node) || !e3.includes(t4.node) || false !== t4.node.walk(n3, t4.state)) && void 0), t3);
}
function replaceComponentValues(e3, n3) {
  for (let t3 = 0; t3 < e3.length; t3++) {
    walk(e3[t3], (e4, t4) => {
      if ("number" != typeof t4) return;
      const o3 = n3(e4.node);
      o3 && (Array.isArray(o3) ? e4.parent.value.splice(t4, 1, ...o3) : e4.parent.value.splice(t4, 1, o3));
    });
  }
  return e3;
}
function isSimpleBlockNode(e3) {
  return SimpleBlockNode.isSimpleBlockNode(e3);
}
function isFunctionNode(e3) {
  return FunctionNode.isFunctionNode(e3);
}
function isWhitespaceNode(e3) {
  return WhitespaceNode.isWhitespaceNode(e3);
}
function isCommentNode(e3) {
  return CommentNode.isCommentNode(e3);
}
function isWhiteSpaceOrCommentNode(e3) {
  return isWhitespaceNode(e3) || isCommentNode(e3);
}
function isTokenNode(e3) {
  return TokenNode.isTokenNode(e3);
}
function sourceIndices(e3) {
  if (Array.isArray(e3)) {
    const n4 = e3[0];
    if (!n4) return [0, 0];
    const t4 = e3[e3.length - 1] || n4;
    return [sourceIndices(n4)[0], sourceIndices(t4)[1]];
  }
  const n3 = e3.tokens(), t3 = n3[0], o3 = n3[n3.length - 1];
  return t3 && o3 ? [t3[2], o3[3]] : [0, 0];
}

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@csstools/css-calc/dist/index.mjs
var ParseError2 = class extends Error {
  sourceStart;
  sourceEnd;
  constructor(e3, n3, t3) {
    super(e3), this.name = "ParseError", this.sourceStart = n3, this.sourceEnd = t3;
  }
};
var ParseErrorWithComponentValues = class extends ParseError2 {
  componentValues;
  constructor(n3, t3) {
    super(n3, ...sourceIndices(t3)), this.componentValues = t3;
  }
};
var I = { UnexpectedAdditionOfDimensionOrPercentageWithNumber: "Unexpected addition of a dimension or percentage with a number.", UnexpectedSubtractionOfDimensionOrPercentageWithNumber: "Unexpected subtraction of a dimension or percentage with a number." };
var x = /[A-Z]/g;
function toLowerCaseAZ(e3) {
  return e3.replace(x, (e4) => String.fromCharCode(e4.charCodeAt(0) + 32));
}
var M = { cm: "px", in: "px", mm: "px", pc: "px", pt: "px", px: "px", q: "px", deg: "deg", grad: "deg", rad: "deg", turn: "deg", ms: "s", s: "s", hz: "hz", khz: "hz" };
var T = /* @__PURE__ */ new Map([["cm", (e3) => e3], ["mm", (e3) => 10 * e3], ["q", (e3) => 40 * e3], ["in", (e3) => e3 / 2.54], ["pc", (e3) => e3 / 2.54 * 6], ["pt", (e3) => e3 / 2.54 * 72], ["px", (e3) => e3 / 2.54 * 96]]);
var P = /* @__PURE__ */ new Map([["deg", (e3) => e3], ["grad", (e3) => e3 / 0.9], ["rad", (e3) => e3 / 180 * Math.PI], ["turn", (e3) => e3 / 360]]);
var k = /* @__PURE__ */ new Map([["deg", (e3) => 0.9 * e3], ["grad", (e3) => e3], ["rad", (e3) => 0.9 * e3 / 180 * Math.PI], ["turn", (e3) => 0.9 * e3 / 360]]);
var W = /* @__PURE__ */ new Map([["hz", (e3) => e3], ["khz", (e3) => e3 / 1e3]]);
var O = /* @__PURE__ */ new Map([["cm", (e3) => 2.54 * e3], ["mm", (e3) => 25.4 * e3], ["q", (e3) => 25.4 * e3 * 4], ["in", (e3) => e3], ["pc", (e3) => 6 * e3], ["pt", (e3) => 72 * e3], ["px", (e3) => 96 * e3]]);
var U = /* @__PURE__ */ new Map([["hz", (e3) => 1e3 * e3], ["khz", (e3) => e3]]);
var L = /* @__PURE__ */ new Map([["cm", (e3) => e3 / 10], ["mm", (e3) => e3], ["q", (e3) => 4 * e3], ["in", (e3) => e3 / 25.4], ["pc", (e3) => e3 / 25.4 * 6], ["pt", (e3) => e3 / 25.4 * 72], ["px", (e3) => e3 / 25.4 * 96]]);
var $ = /* @__PURE__ */ new Map([["ms", (e3) => e3], ["s", (e3) => e3 / 1e3]]);
var V = /* @__PURE__ */ new Map([["cm", (e3) => e3 / 6 * 2.54], ["mm", (e3) => e3 / 6 * 25.4], ["q", (e3) => e3 / 6 * 25.4 * 4], ["in", (e3) => e3 / 6], ["pc", (e3) => e3], ["pt", (e3) => e3 / 6 * 72], ["px", (e3) => e3 / 6 * 96]]);
var Z = /* @__PURE__ */ new Map([["cm", (e3) => e3 / 72 * 2.54], ["mm", (e3) => e3 / 72 * 25.4], ["q", (e3) => e3 / 72 * 25.4 * 4], ["in", (e3) => e3 / 72], ["pc", (e3) => e3 / 72 * 6], ["pt", (e3) => e3], ["px", (e3) => e3 / 72 * 96]]);
var z = /* @__PURE__ */ new Map([["cm", (e3) => e3 / 96 * 2.54], ["mm", (e3) => e3 / 96 * 25.4], ["q", (e3) => e3 / 96 * 25.4 * 4], ["in", (e3) => e3 / 96], ["pc", (e3) => e3 / 96 * 6], ["pt", (e3) => e3 / 96 * 72], ["px", (e3) => e3]]);
var q = /* @__PURE__ */ new Map([["cm", (e3) => e3 / 4 / 10], ["mm", (e3) => e3 / 4], ["q", (e3) => e3], ["in", (e3) => e3 / 4 / 25.4], ["pc", (e3) => e3 / 4 / 25.4 * 6], ["pt", (e3) => e3 / 4 / 25.4 * 72], ["px", (e3) => e3 / 4 / 25.4 * 96]]);
var G = /* @__PURE__ */ new Map([["deg", (e3) => 180 * e3 / Math.PI], ["grad", (e3) => 180 * e3 / Math.PI / 0.9], ["rad", (e3) => e3], ["turn", (e3) => 180 * e3 / Math.PI / 360]]);
var R = /* @__PURE__ */ new Map([["ms", (e3) => 1e3 * e3], ["s", (e3) => e3]]);
var j = /* @__PURE__ */ new Map([["deg", (e3) => 360 * e3], ["grad", (e3) => 360 * e3 / 0.9], ["rad", (e3) => 360 * e3 / 180 * Math.PI], ["turn", (e3) => e3]]);
var Y = /* @__PURE__ */ new Map([["cm", T], ["mm", L], ["q", q], ["in", O], ["pc", V], ["pt", Z], ["px", z], ["ms", $], ["s", R], ["deg", P], ["grad", k], ["rad", G], ["turn", j], ["hz", W], ["khz", U]]);
function convertUnit(e3, n3) {
  if (!isTokenDimension(e3)) return n3;
  if (!isTokenDimension(n3)) return n3;
  const t3 = toLowerCaseAZ(e3[4].unit), r3 = toLowerCaseAZ(n3[4].unit);
  if (t3 === r3) return n3;
  const a3 = Y.get(r3);
  if (!a3) return n3;
  const u4 = a3.get(t3);
  if (!u4) return n3;
  const o3 = u4(n3[4].value), i3 = [u.Dimension, "", n3[2], n3[3], { ...n3[4], signCharacter: o3 < 0 ? "-" : void 0, type: Number.isInteger(o3) ? a.Integer : a.Number, value: o3 }];
  return mutateUnit(i3, e3[4].unit), i3;
}
function toCanonicalUnit(e3) {
  if (!isTokenDimension(e3)) return e3;
  const n3 = toLowerCaseAZ(e3[4].unit), t3 = M[n3];
  if (n3 === t3) return e3;
  const r3 = Y.get(n3);
  if (!r3) return e3;
  const a3 = r3.get(t3);
  if (!a3) return e3;
  const u4 = a3(e3[4].value), o3 = [u.Dimension, "", e3[2], e3[3], { ...e3[4], signCharacter: u4 < 0 ? "-" : void 0, type: Number.isInteger(u4) ? a.Integer : a.Number, value: u4 }];
  return mutateUnit(o3, t3), o3;
}
function addition(e3, t3) {
  if (2 !== e3.length) return -1;
  const r3 = e3[0].value;
  let a3 = e3[1].value;
  if (isTokenNumber(r3) && isTokenNumber(a3)) {
    const e4 = r3[4].value + a3[4].value;
    return new TokenNode([u.Number, e4.toString(), r3[2], a3[3], { value: e4, type: r3[4].type === a.Integer && a3[4].type === a.Integer ? a.Integer : a.Number }]);
  }
  if (isTokenPercentage(r3) && isTokenPercentage(a3)) {
    const e4 = r3[4].value + a3[4].value;
    return new TokenNode([u.Percentage, e4.toString() + "%", r3[2], a3[3], { value: e4 }]);
  }
  if (isTokenDimension(r3) && isTokenDimension(a3) && (a3 = convertUnit(r3, a3), toLowerCaseAZ(r3[4].unit) === toLowerCaseAZ(a3[4].unit))) {
    const e4 = r3[4].value + a3[4].value;
    return new TokenNode([u.Dimension, e4.toString() + r3[4].unit, r3[2], a3[3], { value: e4, type: r3[4].type === a.Integer && a3[4].type === a.Integer ? a.Integer : a.Number, unit: r3[4].unit }]);
  }
  return (isTokenNumber(r3) && (isTokenDimension(a3) || isTokenPercentage(a3)) || isTokenNumber(a3) && (isTokenDimension(r3) || isTokenPercentage(r3))) && t3.onParseError?.(new ParseErrorWithComponentValues(I.UnexpectedAdditionOfDimensionOrPercentageWithNumber, e3)), -1;
}
function division(e3) {
  if (2 !== e3.length) return -1;
  const t3 = e3[0].value, r3 = e3[1].value;
  if (isTokenNumber(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value / r3[4].value;
    return new TokenNode([u.Number, e4.toString(), t3[2], r3[3], { value: e4, type: Number.isInteger(e4) ? a.Integer : a.Number }]);
  }
  if (isTokenPercentage(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value / r3[4].value;
    return new TokenNode([u.Percentage, e4.toString() + "%", t3[2], r3[3], { value: e4 }]);
  }
  if (isTokenDimension(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value / r3[4].value;
    return new TokenNode([u.Dimension, e4.toString() + t3[4].unit, t3[2], r3[3], { value: e4, type: Number.isInteger(e4) ? a.Integer : a.Number, unit: t3[4].unit }]);
  }
  return -1;
}
function isCalculation(e3) {
  return !!e3 && "object" == typeof e3 && "inputs" in e3 && Array.isArray(e3.inputs) && "operation" in e3;
}
function solve(e3, n3) {
  if (-1 === e3) return -1;
  const r3 = [];
  for (let a3 = 0; a3 < e3.inputs.length; a3++) {
    const u4 = e3.inputs[a3];
    if (isTokenNode(u4)) {
      r3.push(u4);
      continue;
    }
    const o3 = solve(u4, n3);
    if (-1 === o3) return -1;
    r3.push(o3);
  }
  return e3.operation(r3, n3);
}
function multiplication(e3) {
  if (2 !== e3.length) return -1;
  const t3 = e3[0].value, r3 = e3[1].value;
  if (isTokenNumber(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value * r3[4].value;
    return new TokenNode([u.Number, e4.toString(), t3[2], r3[3], { value: e4, type: t3[4].type === a.Integer && r3[4].type === a.Integer ? a.Integer : a.Number }]);
  }
  if (isTokenPercentage(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value * r3[4].value;
    return new TokenNode([u.Percentage, e4.toString() + "%", t3[2], r3[3], { value: e4 }]);
  }
  if (isTokenNumber(t3) && isTokenPercentage(r3)) {
    const e4 = t3[4].value * r3[4].value;
    return new TokenNode([u.Percentage, e4.toString() + "%", t3[2], r3[3], { value: e4 }]);
  }
  if (isTokenDimension(t3) && isTokenNumber(r3)) {
    const e4 = t3[4].value * r3[4].value;
    return new TokenNode([u.Dimension, e4.toString() + t3[4].unit, t3[2], r3[3], { value: e4, type: t3[4].type === a.Integer && r3[4].type === a.Integer ? a.Integer : a.Number, unit: t3[4].unit }]);
  }
  if (isTokenNumber(t3) && isTokenDimension(r3)) {
    const e4 = t3[4].value * r3[4].value;
    return new TokenNode([u.Dimension, e4.toString() + r3[4].unit, t3[2], r3[3], { value: e4, type: t3[4].type === a.Integer && r3[4].type === a.Integer ? a.Integer : a.Number, unit: r3[4].unit }]);
  }
  return -1;
}
function resolveGlobalsAndConstants(e3, r3) {
  for (let a3 = 0; a3 < e3.length; a3++) {
    const u4 = e3[a3];
    if (!isTokenNode(u4)) continue;
    const o3 = u4.value;
    if (!isTokenIdent(o3)) continue;
    const i3 = toLowerCaseAZ(o3[4].value);
    switch (i3) {
      case "e":
        e3.splice(a3, 1, new TokenNode([u.Number, Math.E.toString(), o3[2], o3[3], { value: Math.E, type: a.Number }]));
        break;
      case "pi":
        e3.splice(a3, 1, new TokenNode([u.Number, Math.PI.toString(), o3[2], o3[3], { value: Math.PI, type: a.Number }]));
        break;
      case "infinity":
        e3.splice(a3, 1, new TokenNode([u.Number, "infinity", o3[2], o3[3], { value: 1 / 0, type: a.Number }]));
        break;
      case "-infinity":
        e3.splice(a3, 1, new TokenNode([u.Number, "-infinity", o3[2], o3[3], { value: -1 / 0, type: a.Number }]));
        break;
      case "nan":
        e3.splice(a3, 1, new TokenNode([u.Number, "NaN", o3[2], o3[3], { value: Number.NaN, type: a.Number }]));
        break;
      default:
        if (r3.has(i3)) {
          const t3 = r3.get(i3);
          e3.splice(a3, 1, new TokenNode(t3));
        }
    }
  }
  return e3;
}
function unary(e3) {
  if (1 !== e3.length) return -1;
  const n3 = e3[0].value;
  return isTokenNumeric(n3) ? e3[0] : -1;
}
function resultToCalculation(e3, n3, t3) {
  return isTokenDimension(n3) ? dimensionToCalculation(e3, n3[4].unit, t3) : isTokenPercentage(n3) ? percentageToCalculation(e3, t3) : isTokenNumber(n3) ? numberToCalculation(e3, t3) : -1;
}
function dimensionToCalculation(e3, t3, r3) {
  const a3 = e3.tokens();
  return { inputs: [new TokenNode([u.Dimension, r3.toString() + t3, a3[0][2], a3[a3.length - 1][3], { value: r3, type: Number.isInteger(r3) ? a.Integer : a.Number, unit: t3 }])], operation: unary };
}
function percentageToCalculation(e3, t3) {
  const r3 = e3.tokens();
  return { inputs: [new TokenNode([u.Percentage, t3.toString() + "%", r3[0][2], r3[r3.length - 1][3], { value: t3 }])], operation: unary };
}
function numberToCalculation(e3, t3) {
  const r3 = e3.tokens();
  return { inputs: [new TokenNode([u.Number, t3.toString(), r3[0][2], r3[r3.length - 1][3], { value: t3, type: Number.isInteger(t3) ? a.Integer : a.Number }])], operation: unary };
}
function solveACos(e3, n3) {
  const t3 = n3.value;
  if (!isTokenNumber(t3)) return -1;
  return dimensionToCalculation(e3, "rad", Math.acos(t3[4].value));
}
function solveASin(e3, n3) {
  const t3 = n3.value;
  if (!isTokenNumber(t3)) return -1;
  return dimensionToCalculation(e3, "rad", Math.asin(t3[4].value));
}
function solveATan(e3, n3) {
  const t3 = n3.value;
  if (!isTokenNumber(t3)) return -1;
  return dimensionToCalculation(e3, "rad", Math.atan(t3[4].value));
}
function isDimensionOrNumber(e3) {
  return isTokenDimension(e3) || isTokenNumber(e3);
}
function arrayOfSameNumeric(e3) {
  if (0 === e3.length) return true;
  const n3 = e3[0];
  if (!isTokenNumeric(n3)) return false;
  if (1 === e3.length) return true;
  if (isTokenDimension(n3)) {
    const t3 = toLowerCaseAZ(n3[4].unit);
    for (let r3 = 1; r3 < e3.length; r3++) {
      const a3 = e3[r3];
      if (n3[0] !== a3[0]) return false;
      if (t3 !== toLowerCaseAZ(a3[4].unit)) return false;
    }
    return true;
  }
  for (let t3 = 1; t3 < e3.length; t3++) {
    const r3 = e3[t3];
    if (n3[0] !== r3[0]) return false;
  }
  return true;
}
function twoOfSameNumeric(e3, n3) {
  return !!isTokenNumeric(e3) && (isTokenDimension(e3) ? e3[0] === n3[0] && toLowerCaseAZ(e3[4].unit) === toLowerCaseAZ(n3[4].unit) : e3[0] === n3[0]);
}
function solveATan2(e3, n3, t3) {
  const r3 = n3.value;
  if (!isDimensionOrNumber(r3)) return -1;
  const a3 = convertUnit(r3, t3.value);
  if (!twoOfSameNumeric(r3, a3)) return -1;
  return dimensionToCalculation(e3, "rad", Math.atan2(r3[4].value, a3[4].value));
}
function solveAbs(e3, n3, t3) {
  const r3 = n3.value;
  if (!isTokenNumeric(r3)) return -1;
  if (!t3.rawPercentages && isTokenPercentage(r3)) return -1;
  return resultToCalculation(e3, r3, Math.abs(r3[4].value));
}
function solveClamp(e3, n3, r3, a3, u4) {
  if (!isTokenNode(n3) || !isTokenNode(r3) || !isTokenNode(a3)) return -1;
  const o3 = n3.value;
  if (!isTokenNumeric(o3)) return -1;
  if (!u4.rawPercentages && isTokenPercentage(o3)) return -1;
  const i3 = convertUnit(o3, r3.value);
  if (!twoOfSameNumeric(o3, i3)) return -1;
  const l3 = convertUnit(o3, a3.value);
  if (!twoOfSameNumeric(o3, l3)) return -1;
  return resultToCalculation(e3, o3, Math.max(o3[4].value, Math.min(i3[4].value, l3[4].value)));
}
function solveCos(e3, n3) {
  const t3 = n3.value;
  if (!isDimensionOrNumber(t3)) return -1;
  let r3 = t3[4].value;
  if (isTokenDimension(t3)) switch (t3[4].unit.toLowerCase()) {
    case "rad":
      break;
    case "deg":
      r3 = P.get("rad")(t3[4].value);
      break;
    case "grad":
      r3 = k.get("rad")(t3[4].value);
      break;
    case "turn":
      r3 = j.get("rad")(t3[4].value);
      break;
    default:
      return -1;
  }
  return r3 = Math.cos(r3), numberToCalculation(e3, r3);
}
function solveExp(e3, n3) {
  const t3 = n3.value;
  if (!isTokenNumber(t3)) return -1;
  return numberToCalculation(e3, Math.exp(t3[4].value));
}
function solveHypot(e3, n3, r3) {
  if (!n3.every(isTokenNode)) return -1;
  const a3 = n3[0].value;
  if (!isTokenNumeric(a3)) return -1;
  if (!r3.rawPercentages && isTokenPercentage(a3)) return -1;
  const u4 = n3.map((e4) => convertUnit(a3, e4.value));
  if (!arrayOfSameNumeric(u4)) return -1;
  const o3 = u4.map((e4) => e4[4].value), i3 = Math.hypot(...o3);
  return resultToCalculation(e3, a3, i3);
}
function solveMax(e3, n3, r3) {
  if (!n3.every(isTokenNode)) return -1;
  const a3 = n3[0].value;
  if (!isTokenNumeric(a3)) return -1;
  if (!r3.rawPercentages && isTokenPercentage(a3)) return -1;
  const u4 = n3.map((e4) => convertUnit(a3, e4.value));
  if (!arrayOfSameNumeric(u4)) return -1;
  const o3 = u4.map((e4) => e4[4].value), i3 = Math.max(...o3);
  return resultToCalculation(e3, a3, i3);
}
function solveMin(e3, n3, r3) {
  if (!n3.every(isTokenNode)) return -1;
  const a3 = n3[0].value;
  if (!isTokenNumeric(a3)) return -1;
  if (!r3.rawPercentages && isTokenPercentage(a3)) return -1;
  const u4 = n3.map((e4) => convertUnit(a3, e4.value));
  if (!arrayOfSameNumeric(u4)) return -1;
  const o3 = u4.map((e4) => e4[4].value), i3 = Math.min(...o3);
  return resultToCalculation(e3, a3, i3);
}
function solveMod(e3, n3, t3) {
  const r3 = n3.value;
  if (!isTokenNumeric(r3)) return -1;
  const a3 = convertUnit(r3, t3.value);
  if (!twoOfSameNumeric(r3, a3)) return -1;
  let u4;
  return u4 = 0 === a3[4].value ? Number.NaN : Number.isFinite(r3[4].value) && (Number.isFinite(a3[4].value) || (a3[4].value !== Number.POSITIVE_INFINITY || r3[4].value !== Number.NEGATIVE_INFINITY && !Object.is(0 * r3[4].value, -0)) && (a3[4].value !== Number.NEGATIVE_INFINITY || r3[4].value !== Number.POSITIVE_INFINITY && !Object.is(0 * r3[4].value, 0))) ? Number.isFinite(a3[4].value) ? (r3[4].value % a3[4].value + a3[4].value) % a3[4].value : r3[4].value : Number.NaN, resultToCalculation(e3, r3, u4);
}
function solvePow(e3, n3, t3) {
  const r3 = n3.value, a3 = t3.value;
  if (!isTokenNumber(r3)) return -1;
  if (!twoOfSameNumeric(r3, a3)) return -1;
  return numberToCalculation(e3, Math.pow(r3[4].value, a3[4].value));
}
function solveRem(e3, n3, t3) {
  const r3 = n3.value;
  if (!isTokenNumeric(r3)) return -1;
  const a3 = convertUnit(r3, t3.value);
  if (!twoOfSameNumeric(r3, a3)) return -1;
  let u4;
  return u4 = 0 === a3[4].value ? Number.NaN : Number.isFinite(r3[4].value) ? Number.isFinite(a3[4].value) ? r3[4].value % a3[4].value : r3[4].value : Number.NaN, resultToCalculation(e3, r3, u4);
}
function snapAsBorderWidth(e3, n3, t3) {
  if (!isTokenDimension(n3)) return -1;
  const r3 = t3.devicePixelLength ?? 1, a3 = [u.Dimension, `${r3}px`, n3[2], n3[3], { value: r3, type: a.Integer, unit: "px" }], u4 = convertUnit(a3, n3);
  if (!twoOfSameNumeric(u4, a3)) return -1;
  if (Number.isInteger(u4[4].value / r3)) return resultToCalculation(e3, n3, n3[4].value);
  if (u4[4].value > 0) {
    if (u4[4].value < r3) return resultToCalculation(e3, n3, convertUnit(n3, a3)[4].value);
    const t4 = Math.floor(u4[4].value / a3[4].value) * a3[4].value;
    return u4[4].value = t4, resultToCalculation(e3, n3, convertUnit(n3, u4)[4].value);
  }
  if (Math.abs(u4[4].value) < r3) return resultToCalculation(e3, n3, -1 * convertUnit(n3, a3)[4].value);
  const o3 = Math.ceil(u4[4].value / a3[4].value) * a3[4].value;
  return u4[4].value = o3, resultToCalculation(e3, n3, convertUnit(n3, u4)[4].value);
}
function solveRound(e3, n3, t3, r3, a3) {
  const u4 = t3.value;
  if (!isTokenNumeric(u4)) return -1;
  if ("line-width" === n3 && !isTokenDimension(u4)) return -1;
  if (!a3.rawPercentages && isTokenPercentage(u4)) return -1;
  const o3 = convertUnit(u4, r3.value);
  if (!twoOfSameNumeric(u4, o3)) return -1;
  let i3;
  if (0 === o3[4].value) i3 = Number.NaN;
  else if (Number.isFinite(u4[4].value) || Number.isFinite(o3[4].value)) if (!Number.isFinite(u4[4].value) && Number.isFinite(o3[4].value)) i3 = u4[4].value;
  else if (Number.isFinite(u4[4].value) && !Number.isFinite(o3[4].value)) switch (n3) {
    case "down":
      i3 = u4[4].value < 0 ? -1 / 0 : Object.is(-0, 0 * u4[4].value) ? -0 : 0;
      break;
    case "up":
      i3 = u4[4].value > 0 ? 1 / 0 : Object.is(0, 0 * u4[4].value) ? 0 : -0;
      break;
    default:
      i3 = Object.is(0, 0 * u4[4].value) ? 0 : -0;
  }
  else switch (n3) {
    case "down":
      i3 = Math.floor(u4[4].value / o3[4].value) * o3[4].value;
      break;
    case "up":
      i3 = Math.ceil(u4[4].value / o3[4].value) * o3[4].value;
      break;
    case "to-zero":
      i3 = Math.trunc(u4[4].value / o3[4].value) * o3[4].value;
      break;
    default: {
      let t4 = Math.floor(u4[4].value / o3[4].value) * o3[4].value, r4 = Math.ceil(u4[4].value / o3[4].value) * o3[4].value;
      if (t4 > r4) {
        const e4 = t4;
        t4 = r4, r4 = e4;
      }
      const l3 = Math.abs(u4[4].value - t4), c4 = Math.abs(u4[4].value - r4);
      if (i3 = "line-width" === n3 && u4[4].value >= 0 && (0 === r4 || 0 === t4) ? 0 !== r4 ? r4 : t4 : l3 === c4 ? r4 : l3 < c4 ? t4 : r4, "line-width" === n3) {
        const n4 = solve(resultToCalculation(e3, u4, i3), a3);
        return -1 === n4 ? -1 : snapAsBorderWidth(e3, n4.value, a3);
      }
      break;
    }
  }
  else i3 = Number.NaN;
  return resultToCalculation(e3, u4, i3);
}
function solveSign(e3, n3, t3) {
  const r3 = n3.value;
  if (!isTokenNumeric(r3)) return -1;
  if (!t3.rawPercentages && isTokenPercentage(r3)) return -1;
  return numberToCalculation(e3, Math.sign(r3[4].value));
}
function solveSin(e3, n3) {
  const t3 = n3.value;
  if (!isDimensionOrNumber(t3)) return -1;
  let r3 = t3[4].value;
  if (isTokenDimension(t3)) switch (toLowerCaseAZ(t3[4].unit)) {
    case "rad":
      break;
    case "deg":
      r3 = P.get("rad")(t3[4].value);
      break;
    case "grad":
      r3 = k.get("rad")(t3[4].value);
      break;
    case "turn":
      r3 = j.get("rad")(t3[4].value);
      break;
    default:
      return -1;
  }
  return r3 = Math.sin(r3), numberToCalculation(e3, r3);
}
function solveSqrt(e3, n3) {
  const t3 = n3.value;
  if (!isTokenNumber(t3)) return -1;
  return numberToCalculation(e3, Math.sqrt(t3[4].value));
}
function solveTan(e3, n3) {
  const t3 = n3.value;
  if (!isDimensionOrNumber(t3)) return -1;
  const r3 = t3[4].value;
  let a3 = 0, u4 = t3[4].value;
  if (isTokenDimension(t3)) switch (toLowerCaseAZ(t3[4].unit)) {
    case "rad":
      a3 = G.get("deg")(r3);
      break;
    case "deg":
      a3 = r3, u4 = P.get("rad")(r3);
      break;
    case "grad":
      a3 = k.get("deg")(r3), u4 = k.get("rad")(r3);
      break;
    case "turn":
      a3 = j.get("deg")(r3), u4 = j.get("rad")(r3);
      break;
    default:
      return -1;
  }
  const o3 = a3 / 90;
  return u4 = a3 % 90 == 0 && o3 % 2 != 0 ? o3 > 0 ? 1 / 0 : -1 / 0 : Math.tan(u4), numberToCalculation(e3, u4);
}
function subtraction(e3, t3) {
  if (2 !== e3.length) return -1;
  const r3 = e3[0].value;
  let a3 = e3[1].value;
  if (isTokenNumber(r3) && isTokenNumber(a3)) {
    const e4 = r3[4].value - a3[4].value;
    return new TokenNode([u.Number, e4.toString(), r3[2], a3[3], { value: e4, type: r3[4].type === a.Integer && a3[4].type === a.Integer ? a.Integer : a.Number }]);
  }
  if (isTokenPercentage(r3) && isTokenPercentage(a3)) {
    const e4 = r3[4].value - a3[4].value;
    return new TokenNode([u.Percentage, e4.toString() + "%", r3[2], a3[3], { value: e4 }]);
  }
  if (isTokenDimension(r3) && isTokenDimension(a3) && (a3 = convertUnit(r3, a3), toLowerCaseAZ(r3[4].unit) === toLowerCaseAZ(a3[4].unit))) {
    const e4 = r3[4].value - a3[4].value;
    return new TokenNode([u.Dimension, e4.toString() + r3[4].unit, r3[2], a3[3], { value: e4, type: r3[4].type === a.Integer && a3[4].type === a.Integer ? a.Integer : a.Number, unit: r3[4].unit }]);
  }
  return (isTokenNumber(r3) && (isTokenDimension(a3) || isTokenPercentage(a3)) || isTokenNumber(a3) && (isTokenDimension(r3) || isTokenPercentage(r3))) && t3.onParseError?.(new ParseErrorWithComponentValues(I.UnexpectedSubtractionOfDimensionOrPercentageWithNumber, e3)), -1;
}
function solveLog(e3, n3) {
  if (1 === n3.length) {
    const r3 = n3[0];
    if (!r3 || !isTokenNode(r3)) return -1;
    const a3 = r3.value;
    if (!isTokenNumber(a3)) return -1;
    return numberToCalculation(e3, Math.log(a3[4].value));
  }
  if (2 === n3.length) {
    const r3 = n3[0];
    if (!r3 || !isTokenNode(r3)) return -1;
    const a3 = r3.value;
    if (!isTokenNumber(a3)) return -1;
    const u4 = n3[1];
    if (!u4 || !isTokenNode(u4)) return -1;
    const o3 = u4.value;
    if (!isTokenNumber(o3)) return -1;
    return numberToCalculation(e3, Math.log(a3[4].value) / Math.log(o3[4].value));
  }
  return -1;
}
var _ = /^none$/i;
function isNone(e3) {
  if (Array.isArray(e3)) {
    const n4 = e3.filter((e4) => !(isWhitespaceNode(e4) && isCommentNode(e4)));
    return 1 === n4.length && isNone(n4[0]);
  }
  if (!isTokenNode(e3)) return false;
  const n3 = e3.value;
  return !!isTokenIdent(n3) && _.test(n3[4].value);
}
var H = String.fromCodePoint(0);
function solveRandom(e3, n3, t3, r3, a3, u4) {
  if (-1 === n3.fixed && !u4.randomCaching) return -1;
  u4.randomCaching || (u4.randomCaching = { propertyName: "", propertyN: 0, elementID: "", documentID: "" }), u4.randomCaching && !u4.randomCaching.propertyN && (u4.randomCaching.propertyN = 0);
  const o3 = t3.value;
  if (!isTokenNumeric(o3)) return -1;
  const i3 = convertUnit(o3, r3.value);
  if (!twoOfSameNumeric(o3, i3)) return -1;
  let l3 = null;
  if (a3 && (l3 = convertUnit(o3, a3.value), !twoOfSameNumeric(o3, l3))) return -1;
  if (!Number.isFinite(o3[4].value)) return resultToCalculation(e3, o3, Number.NaN);
  if (!Number.isFinite(i3[4].value)) return resultToCalculation(e3, o3, Number.NaN);
  if (!Number.isFinite(i3[4].value - o3[4].value)) return resultToCalculation(e3, o3, Number.NaN);
  if (l3 && !Number.isFinite(l3[4].value)) return resultToCalculation(e3, o3, o3[4].value);
  const c4 = -1 === n3.fixed ? sfc32(crc32([n3.dashedIdent ? n3.dashedIdent : "", n3.elementScoped ? u4.randomCaching.elementID : "", n3.propertyScoped || n3.propertyIndexScoped ? u4.randomCaching.propertyName : "", n3.propertyIndexScoped ? u4.randomCaching.propertyN : "", u4.randomCaching.documentID].join(H))) : () => n3.fixed;
  let s4 = o3[4].value, v2 = i3[4].value;
  if (s4 > v2 && ([s4, v2] = [v2, s4]), l3 && (l3[4].value <= 0 || Math.abs(s4 - v2) / l3[4].value > 1e10) && (l3 = null), l3) {
    const n4 = Math.max(l3[4].value / 1e3, 1e-9), t4 = [s4];
    let r4 = 0;
    for (; ; ) {
      r4 += l3[4].value;
      const e4 = s4 + r4;
      if (!(e4 + n4 < v2)) {
        t4.push(v2);
        break;
      }
      if (t4.push(e4), e4 + l3[4].value - n4 > v2) break;
    }
    const a4 = c4();
    return resultToCalculation(e3, o3, Number(t4[Math.floor(t4.length * a4)].toFixed(5)));
  }
  const f4 = c4();
  return resultToCalculation(e3, o3, Number((f4 * (v2 - s4) + s4).toFixed(5)));
}
function sfc32(e3 = 0.34944106645296036, n3 = 0.19228640875738723, t3 = 0.8784393832007205, r3 = 0.04850964319275053) {
  return () => {
    const a3 = ((e3 |= 0) + (n3 |= 0) | 0) + (r3 |= 0) | 0;
    return r3 = r3 + 1 | 0, e3 = n3 ^ n3 >>> 9, n3 = (t3 |= 0) + (t3 << 3) | 0, t3 = (t3 = t3 << 21 | t3 >>> 11) + a3 | 0, (a3 >>> 0) / 4294967296;
  };
}
function crc32(e3) {
  let n3, t3, r3 = 0;
  r3 ^= -1;
  for (let a3 = 0, u4 = e3.length; a3 < u4; a3++) t3 = 255 & (r3 ^ e3.charCodeAt(a3)), n3 = Number("0x" + "00000000 77073096 EE0E612C 990951BA 076DC419 706AF48F E963A535 9E6495A3 0EDB8832 79DCB8A4 E0D5E91E 97D2D988 09B64C2B 7EB17CBD E7B82D07 90BF1D91 1DB71064 6AB020F2 F3B97148 84BE41DE 1ADAD47D 6DDDE4EB F4D4B551 83D385C7 136C9856 646BA8C0 FD62F97A 8A65C9EC 14015C4F 63066CD9 FA0F3D63 8D080DF5 3B6E20C8 4C69105E D56041E4 A2677172 3C03E4D1 4B04D447 D20D85FD A50AB56B 35B5A8FA 42B2986C DBBBC9D6 ACBCF940 32D86CE3 45DF5C75 DCD60DCF ABD13D59 26D930AC 51DE003A C8D75180 BFD06116 21B4F4B5 56B3C423 CFBA9599 B8BDA50F 2802B89E 5F058808 C60CD9B2 B10BE924 2F6F7C87 58684C11 C1611DAB B6662D3D 76DC4190 01DB7106 98D220BC EFD5102A 71B18589 06B6B51F 9FBFE4A5 E8B8D433 7807C9A2 0F00F934 9609A88E E10E9818 7F6A0DBB 086D3D2D 91646C97 E6635C01 6B6B51F4 1C6C6162 856530D8 F262004E 6C0695ED 1B01A57B 8208F4C1 F50FC457 65B0D9C6 12B7E950 8BBEB8EA FCB9887C 62DD1DDF 15DA2D49 8CD37CF3 FBD44C65 4DB26158 3AB551CE A3BC0074 D4BB30E2 4ADFA541 3DD895D7 A4D1C46D D3D6F4FB 4369E96A 346ED9FC AD678846 DA60B8D0 44042D73 33031DE5 AA0A4C5F DD0D7CC9 5005713C 270241AA BE0B1010 C90C2086 5768B525 206F85B3 B966D409 CE61E49F 5EDEF90E 29D9C998 B0D09822 C7D7A8B4 59B33D17 2EB40D81 B7BD5C3B C0BA6CAD EDB88320 9ABFB3B6 03B6E20C 74B1D29A EAD54739 9DD277AF 04DB2615 73DC1683 E3630B12 94643B84 0D6D6A3E 7A6A5AA8 E40ECF0B 9309FF9D 0A00AE27 7D079EB1 F00F9344 8708A3D2 1E01F268 6906C2FE F762575D 806567CB 196C3671 6E6B06E7 FED41B76 89D32BE0 10DA7A5A 67DD4ACC F9B9DF6F 8EBEEFF9 17B7BE43 60B08ED5 D6D6A3E8 A1D1937E 38D8C2C4 4FDFF252 D1BB67F1 A6BC5767 3FB506DD 48B2364B D80D2BDA AF0A1B4C 36034AF6 41047A60 DF60EFC3 A867DF55 316E8EEF 4669BE79 CB61B38C BC66831A 256FD2A0 5268E236 CC0C7795 BB0B4703 220216B9 5505262F C5BA3BBE B2BD0B28 2BB45A92 5CB36A04 C2D7FFA7 B5D0CF31 2CD99E8B 5BDEAE1D 9B64C2B0 EC63F226 756AA39C 026D930A 9C0906A9 EB0E363F 72076785 05005713 95BF4A82 E2B87A14 7BB12BAE 0CB61B38 92D28E9B E5D5BE0D 7CDCEFB7 0BDBDF21 86D3D2D4 F1D4E242 68DDB3F8 1FDA836E 81BE16CD F6B9265B 6FB077E1 18B74777 88085AE6 FF0F6A70 66063BCA 11010B5C 8F659EFF F862AE69 616BFFD3 166CCF45 A00AE278 D70DD2EE 4E048354 3903B3C2 A7672661 D06016F7 4969474D 3E6E77DB AED16A4A D9D65ADC 40DF0B66 37D83BF0 A9BCAE53 DEBB9EC5 47B2CF7F 30B5FFE9 BDBDF21C CABAC28A 53B39330 24B4A3A6 BAD03605 CDD70693 54DE5729 23D967BF B3667A2E C4614AB8 5D681B02 2A6F2B94 B40BBE37 C30C8EA1 5A05DF1B 2D02EF8D".substring(9 * t3, 9 * t3 + 8)), r3 = r3 >>> 8 ^ n3;
  return (-1 ^ r3) >>> 0;
}
function solveCalcMix(e3, n3) {
  const t3 = n3[0].calcSum.value;
  if (!isTokenNumeric(t3)) return -1;
  const r3 = n3.map((e4) => ({ calcSum: convertUnit(t3, e4.calcSum.value), percentage: e4.percentage }));
  if (!arrayOfSameNumeric(r3.map((e4) => e4.calcSum))) return -1;
  const { items: a3 } = normalizeMixPercentages(r3, false), u4 = a3.map((e4) => e4.calcSum[4].value * e4.percentage / 100);
  let o3 = 0;
  for (let e4 = 0; e4 < u4.length; e4++) o3 += u4[e4];
  return resultToCalculation(e3, t3, o3);
}
function normalizeMixPercentages(e3, n3 = false) {
  let t3 = 0, r3 = 0;
  for (const n4 of e3) n4.percentage && (t3 += n4.percentage), false === n4.percentage && r3++;
  t3 = Math.min(100, t3);
  for (const n4 of e3) false === n4.percentage && (n4.percentage = (100 - t3) / r3);
  const a3 = e3.slice();
  let u4 = 0;
  for (const e4 of a3) u4 += e4.percentage;
  if (u4 > 100 || u4 > 0 && n3) for (const e4 of a3) e4.percentage = e4.percentage * (100 / u4);
  let o3 = 0;
  return u4 < 100 && (o3 = 100 - u4), { items: a3, leftover: o3 };
}
var J = /* @__PURE__ */ new Map([["abs", function abs(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveAbs);
}], ["acos", function acos(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveACos);
}], ["asin", function asin(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveASin);
}], ["atan", function atan(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveATan);
}], ["atan2", function atan2(e3, n3, t3) {
  return twoCommaSeparatedNodesSolver(e3, n3, t3, solveATan2);
}], ["calc", calc$1], ["calc-mix", function calcMix(e3, n3, t3) {
  const r3 = variadicArgumentsCalcMix(e3, e3.value, n3, t3);
  if (-1 === r3) return -1;
  return solveCalcMix(e3, r3);
}], ["clamp", function clamp(r3, a3, o3) {
  const i3 = resolveGlobalsAndConstants([...r3.value.filter((e3) => !isWhiteSpaceOrCommentNode(e3))], a3), c4 = [], s4 = [], v2 = [];
  {
    let e3 = c4;
    for (let n3 = 0; n3 < i3.length; n3++) {
      const r4 = i3[n3];
      if (isTokenNode(r4) && isTokenComma(r4.value)) {
        if (e3 === v2) return -1;
        if (e3 === s4) {
          e3 = v2;
          continue;
        }
        if (e3 === c4) {
          e3 = s4;
          continue;
        }
        return -1;
      }
      e3.push(r4);
    }
  }
  const f4 = isNone(c4), m3 = isNone(v2);
  if (f4 && m3) return calc$1(calcWrapper(r3, s4), a3, o3);
  const d5 = solve(calc$1(calcWrapper(r3, s4), a3, o3), o3);
  if (-1 === d5) return -1;
  if (f4) {
    const t3 = solve(calc$1(calcWrapper(r3, v2), a3, o3), o3);
    return -1 === t3 ? -1 : solveMin((C3 = r3, g3 = d5, D3 = t3, new FunctionNode([u.Function, "min(", C3.name[2], C3.name[3], { value: "min" }], [u.CloseParen, ")", C3.endToken[2], C3.endToken[3], void 0], [g3, new TokenNode([u.Comma, ",", ...sourceIndices(g3), void 0]), D3])), [d5, t3], o3);
  }
  if (m3) {
    const e3 = solve(calc$1(calcWrapper(r3, c4), a3, o3), o3);
    return -1 === e3 ? -1 : solveMax(maxWrapper(r3, e3, d5), [e3, d5], o3);
  }
  var C3, g3, D3;
  const h3 = solve(calc$1(calcWrapper(r3, c4), a3, o3), o3);
  if (-1 === h3) return -1;
  const N2 = solve(calc$1(calcWrapper(r3, v2), a3, o3), o3);
  if (-1 === N2) return -1;
  return solveClamp(r3, h3, d5, N2, o3);
}], ["cos", function cos(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveCos);
}], ["exp", function exp(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveExp);
}], ["hypot", function hypot(e3, n3, t3) {
  return variadicNodesSolver(e3, n3, t3, solveHypot);
}], ["log", function log(e3, n3, t3) {
  return variadicNodesSolver(e3, n3, t3, solveLog);
}], ["max", function max(e3, n3, t3) {
  return variadicNodesSolver(e3, n3, t3, solveMax);
}], ["min", function min(e3, n3, t3) {
  return variadicNodesSolver(e3, n3, t3, solveMin);
}], ["mod", function mod(e3, n3, t3) {
  return twoCommaSeparatedNodesSolver(e3, n3, t3, solveMod);
}], ["pow", function pow(e3, n3, t3) {
  return twoCommaSeparatedNodesSolver(e3, n3, t3, solvePow);
}], ["random", function random(e3, n3, t3) {
  const r3 = parseRandomValueSharing(e3, e3.value.filter((e4) => !isWhiteSpaceOrCommentNode(e4)), n3, t3);
  if (-1 === r3) return -1;
  const [a3, o3] = r3, i3 = variadicArguments(e3, o3, n3, t3);
  if (-1 === i3) return -1;
  const [l3, c4, s4] = i3;
  if (!l3 || !c4) return -1;
  return solveRandom(e3, a3, l3, c4, s4, t3);
}], ["rem", function rem(e3, n3, t3) {
  return twoCommaSeparatedNodesSolver(e3, n3, t3, solveRem);
}], ["round", function round(e3, r3, a3) {
  const o3 = resolveGlobalsAndConstants([...e3.value.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], r3);
  let i3 = "", l3 = false;
  const c4 = [], s4 = [];
  {
    let e4 = c4;
    for (let n3 = 0; n3 < o3.length; n3++) {
      const r4 = o3[n3];
      if (!i3 && 0 === c4.length && 0 === s4.length && isTokenNode(r4) && isTokenIdent(r4.value)) {
        const e5 = r4.value[4].value.toLowerCase();
        if (K.has(e5)) {
          i3 = e5;
          continue;
        }
      }
      if (isTokenNode(r4) && isTokenComma(r4.value)) {
        if (e4 === s4) return -1;
        if (e4 === c4 && i3 && 0 === c4.length) continue;
        if (e4 === c4) {
          l3 = true, e4 = s4;
          continue;
        }
        return -1;
      }
      e4.push(r4);
    }
  }
  const v2 = solve(calc$1(calcWrapper(e3, c4), r3, a3), a3);
  if (-1 === v2) return -1;
  if ("line-width" === i3) {
    const e4 = convertUnit([u.Dimension, "1px", v2.value[2], v2.value[3], { value: 1, type: a.Integer, unit: "px" }], v2.value);
    if (!isTokenDimension(e4) || "px" !== e4[4].unit) return -1;
  }
  if (!l3 && 0 === s4.length) {
    if ("line-width" === i3) return snapAsBorderWidth(e3, v2.value, a3);
    s4.push(new TokenNode([u.Number, "1", v2.value[2], v2.value[3], { value: 1, type: a.Integer }]));
  }
  const d5 = solve(calc$1(calcWrapper(e3, s4), r3, a3), a3);
  if (-1 === d5) return -1;
  i3 || (i3 = "nearest");
  return solveRound(e3, i3, v2, d5, a3);
}], ["sign", function sign(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveSign);
}], ["sin", function sin(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveSin);
}], ["sqrt", function sqrt(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveSqrt);
}], ["tan", function tan(e3, n3, t3) {
  return singleNodeSolver(e3, n3, t3, solveTan);
}]]);
function calc$1(e3, n3, r3) {
  const a3 = resolveGlobalsAndConstants([...e3.value.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], n3);
  if (1 === a3.length && isTokenNode(a3[0])) return { inputs: [a3[0]], operation: unary };
  let l3 = 0;
  for (; l3 < a3.length; ) {
    const e4 = a3[l3];
    if (isSimpleBlockNode(e4) && isTokenOpenParen(e4.startToken)) {
      const t3 = calc$1(e4, n3, r3);
      if (-1 === t3) return -1;
      a3.splice(l3, 1, t3);
      continue;
    }
    if (isFunctionNode(e4)) {
      const t3 = J.get(e4.getName().toLowerCase());
      if (!t3) return -1;
      const u4 = t3(e4, n3, r3);
      if (-1 === u4) return -1;
      a3.splice(l3, 1, u4);
      continue;
    }
    l3++;
  }
  if (l3 = 0, 1 === a3.length && isCalculation(a3[0])) return a3[0];
  for (; l3 < a3.length; ) {
    const e4 = a3[l3];
    if (!e4 || !isTokenNode(e4) && !isCalculation(e4)) {
      l3++;
      continue;
    }
    const n4 = a3[l3 + 1];
    if (!n4 || !isTokenNode(n4)) {
      l3++;
      continue;
    }
    const r4 = n4.value;
    if (!isTokenDelim(r4) || "*" !== r4[4].value && "/" !== r4[4].value) {
      l3++;
      continue;
    }
    const u4 = a3[l3 + 2];
    if (!u4 || !isTokenNode(u4) && !isCalculation(u4)) return -1;
    "*" !== r4[4].value ? "/" !== r4[4].value ? l3++ : a3.splice(l3, 3, { inputs: [e4, u4], operation: division }) : a3.splice(l3, 3, { inputs: [e4, u4], operation: multiplication });
  }
  if (l3 = 0, 1 === a3.length && isCalculation(a3[0])) return a3[0];
  for (; l3 < a3.length; ) {
    const e4 = a3[l3];
    if (!e4 || !isTokenNode(e4) && !isCalculation(e4)) {
      l3++;
      continue;
    }
    const n4 = a3[l3 + 1];
    if (!n4 || !isTokenNode(n4)) {
      l3++;
      continue;
    }
    const r4 = n4.value;
    if (!isTokenDelim(r4) || "+" !== r4[4].value && "-" !== r4[4].value) {
      l3++;
      continue;
    }
    const u4 = a3[l3 + 2];
    if (!u4 || !isTokenNode(u4) && !isCalculation(u4)) return -1;
    "+" !== r4[4].value ? "-" !== r4[4].value ? l3++ : a3.splice(l3, 3, { inputs: [e4, u4], operation: subtraction }) : a3.splice(l3, 3, { inputs: [e4, u4], operation: addition });
  }
  return 1 === a3.length && isCalculation(a3[0]) ? a3[0] : -1;
}
function singleNodeSolver(e3, n3, t3, r3) {
  const a3 = singleArgument(e3, n3, t3);
  return -1 === a3 ? -1 : r3(e3, a3, t3);
}
function singleArgument(e3, n3, t3) {
  const r3 = resolveGlobalsAndConstants([...e3.value.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], n3), a3 = solve(calc$1(calcWrapper(e3, r3), n3, t3), t3);
  return -1 === a3 ? -1 : a3;
}
function twoCommaSeparatedNodesSolver(e3, n3, t3, r3) {
  const a3 = twoCommaSeparatedArguments(e3, n3, t3);
  if (-1 === a3) return -1;
  const [u4, o3] = a3;
  return r3(e3, u4, o3, t3);
}
function twoCommaSeparatedArguments(e3, n3, r3) {
  const a3 = resolveGlobalsAndConstants([...e3.value.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], n3), o3 = [], i3 = [];
  {
    let e4 = o3;
    for (let n4 = 0; n4 < a3.length; n4++) {
      const r4 = a3[n4];
      if (isTokenNode(r4) && isTokenComma(r4.value)) {
        if (e4 === i3) return -1;
        if (e4 === o3) {
          e4 = i3;
          continue;
        }
        return -1;
      }
      e4.push(r4);
    }
  }
  const l3 = solve(calc$1(calcWrapper(e3, o3), n3, r3), r3);
  if (-1 === l3) return -1;
  const c4 = solve(calc$1(calcWrapper(e3, i3), n3, r3), r3);
  return -1 === c4 ? -1 : [l3, c4];
}
function variadicNodesSolver(e3, n3, t3, r3) {
  const a3 = variadicArguments(e3, e3.value, n3, t3);
  return -1 === a3 ? -1 : r3(e3, a3, t3);
}
function variadicArguments(e3, n3, r3, a3) {
  const o3 = resolveGlobalsAndConstants([...n3.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], r3), i3 = [];
  {
    const n4 = [];
    let u4 = [];
    for (let e4 = 0; e4 < o3.length; e4++) {
      const r4 = o3[e4];
      isTokenNode(r4) && isTokenComma(r4.value) ? (n4.push(u4), u4 = []) : u4.push(r4);
    }
    n4.push(u4);
    for (let t3 = 0; t3 < n4.length; t3++) {
      if (0 === n4[t3].length) return -1;
      const u5 = solve(calc$1(calcWrapper(e3, n4[t3]), r3, a3), a3);
      if (-1 === u5) return -1;
      i3.push(u5);
    }
  }
  return i3;
}
function variadicArgumentsCalcMix(e3, n3, r3, a3) {
  const o3 = resolveGlobalsAndConstants([...n3.filter((e4) => !isWhiteSpaceOrCommentNode(e4))], r3), i3 = [];
  {
    const n4 = [];
    let l3 = [];
    for (let e4 = 0; e4 < o3.length; e4++) {
      const r4 = o3[e4];
      isTokenNode(r4) && isTokenComma(r4.value) ? (n4.push(l3), l3 = []) : l3.push(r4);
    }
    n4.push(l3);
    for (let o4 = 0; o4 < n4.length; o4++) {
      if (0 === n4[o4].length) return -1;
      let l4 = -1, c4 = false;
      for (let i4 = n4[o4].length - 1; i4 >= 0; i4--) {
        if (isWhiteSpaceOrCommentNode(n4[o4][i4])) continue;
        if (l4 = solve(calc$1(calcWrapper(e3, n4[o4].slice(0, i4 + 1)), r3, a3), a3), -1 === l4) continue;
        const s4 = n4[o4].slice(i4 + 1).filter((e4) => !isWhiteSpaceOrCommentNode(e4));
        if (s4.length) if (1 === s4.length && isTokenNode(s4[0]) && isTokenPercentage(s4[0].value)) {
          if (c4 = s4[0].value[4].value, c4 < 0 || c4 > 100) return -1;
        } else {
          const n5 = solve(calc$1(calcWrapper(e3, s4), r3, a3), a3);
          if (-1 === n5) return -1;
          if (!isTokenPercentage(n5.value)) return -1;
          c4 = n5.value[4].value, c4 = Math.min(100, Math.max(0, c4));
        }
        break;
      }
      if (-1 === l4) return -1;
      i3.push({ calcSum: l4, percentage: c4 });
    }
  }
  return i3;
}
var K = /* @__PURE__ */ new Set(["nearest", "line-width", "up", "down", "to-zero"]);
function parseRandomValueSharing(e3, n3, r3, a3) {
  const u4 = { dashedIdent: "", fixed: -1, elementScoped: false, propertyScoped: false, propertyIndexScoped: false };
  let o3 = false;
  const i3 = n3[0];
  if (!isTokenNode(i3) || !isTokenIdent(i3.value)) return [u4, n3];
  for (let i4 = 0; i4 < n3.length; i4++) {
    const l3 = n3[i4];
    if (!isTokenNode(l3)) return -1;
    if (isTokenComma(l3.value)) return [u4, n3.slice(i4 + 1)];
    if (!isTokenIdent(l3.value)) return -1;
    const c4 = l3.value[4].value.toLowerCase();
    if ("element-scoped" !== c4) if ("property-scoped" !== c4) if ("property-index-scoped" !== c4) {
      if ("fixed" === c4) {
        if (-1 !== u4.fixed || o3 || u4.dashedIdent || u4.elementScoped || u4.propertyScoped || u4.propertyIndexScoped) return -1;
        i4++;
        const t3 = n3[i4];
        if (!t3) return -1;
        const l4 = solve(calc$1(calcWrapper(e3, [t3]), r3, a3), a3);
        if (-1 === l4) return -1;
        if (!isTokenNumber(l4.value)) return -1;
        if (l4.value[4].value < 0 || l4.value[4].value > 1) return -1;
        u4.fixed = Math.max(0, Math.min(l4.value[4].value, 1 - 1e-9));
        continue;
      }
      if ("auto" !== c4) {
        if (!c4.startsWith("--")) return -1;
        if (-1 !== u4.fixed || o3 || u4.dashedIdent) return -1;
        u4.dashedIdent = c4;
      } else {
        if (-1 !== u4.fixed || o3 || u4.dashedIdent || u4.elementScoped || u4.propertyScoped || u4.propertyIndexScoped) return -1;
        u4.elementScoped = true, u4.propertyIndexScoped = true, o3 = true;
      }
    } else {
      if (-1 !== u4.fixed || o3 || u4.propertyScoped || u4.propertyIndexScoped) return -1;
      u4.propertyIndexScoped = true;
    }
    else {
      if (-1 !== u4.fixed || o3 || u4.propertyScoped || u4.propertyIndexScoped) return -1;
      u4.propertyScoped = true;
    }
    else {
      if (-1 !== u4.fixed || o3 || u4.elementScoped) return -1;
      u4.elementScoped = true;
    }
  }
  return -1;
}
function calcWrapper(e3, n3) {
  return new FunctionNode([u.Function, "calc(", e3.name[2], e3.name[3], { value: "calc" }], [u.CloseParen, ")", e3.endToken[2], e3.endToken[3], void 0], n3);
}
function maxWrapper(t3, r3, a3) {
  return new FunctionNode([u.Function, "max(", t3.name[2], t3.name[3], { value: "max" }], [u.CloseParen, ")", t3.endToken[2], t3.endToken[3], void 0], [r3, new TokenNode([u.Comma, ",", ...sourceIndices(r3), void 0]), a3]);
}
function patchNaN(e3) {
  if (-1 === e3) return -1;
  if (isFunctionNode(e3)) return e3;
  const t3 = e3.value;
  return isTokenNumeric(t3) && Number.isNaN(t3[4].value) ? isTokenNumber(t3) ? new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, "NaN", t3[2], t3[3], { value: "NaN" }])]) : isTokenDimension(t3) ? new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, "NaN", t3[2], t3[3], { value: "NaN" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Delim, "*", t3[2], t3[3], { value: "*" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Dimension, "1" + t3[4].unit, t3[2], t3[3], { value: 1, type: a.Integer, unit: t3[4].unit }])]) : isTokenPercentage(t3) ? new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, "NaN", t3[2], t3[3], { value: "NaN" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Delim, "*", t3[2], t3[3], { value: "*" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Percentage, "1%", t3[2], t3[3], { value: 1 }])]) : -1 : e3;
}
function patchInfinity(e3) {
  if (-1 === e3) return -1;
  if (isFunctionNode(e3)) return e3;
  const t3 = e3.value;
  if (!isTokenNumeric(t3)) return e3;
  if (Number.isFinite(t3[4].value) || Number.isNaN(t3[4].value)) return e3;
  let r3 = "";
  return Number.NEGATIVE_INFINITY === t3[4].value && (r3 = "-"), isTokenNumber(t3) ? new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, r3 + "infinity", t3[2], t3[3], { value: r3 + "infinity" }])]) : isTokenDimension(t3) ? new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, r3 + "infinity", t3[2], t3[3], { value: r3 + "infinity" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Delim, "*", t3[2], t3[3], { value: "*" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Dimension, "1" + t3[4].unit, t3[2], t3[3], { value: 1, type: a.Integer, unit: t3[4].unit }])]) : new FunctionNode([u.Function, "calc(", t3[2], t3[3], { value: "calc" }], [u.CloseParen, ")", t3[2], t3[3], void 0], [new TokenNode([u.Ident, r3 + "infinity", t3[2], t3[3], { value: r3 + "infinity" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Delim, "*", t3[2], t3[3], { value: "*" }]), new WhitespaceNode([[u.Whitespace, " ", t3[2], t3[3], void 0]]), new TokenNode([u.Percentage, "1%", t3[2], t3[3], { value: 1 }])]);
}
function patchMinusZero(e3) {
  if (-1 === e3) return -1;
  if (isFunctionNode(e3)) return e3;
  const n3 = e3.value;
  return isTokenNumeric(n3) && Object.is(-0, n3[4].value) ? ("-0" === n3[1] || (isTokenPercentage(n3) ? n3[1] = "-0%" : isTokenDimension(n3) ? n3[1] = "-0" + n3[4].unit : n3[1] = "-0"), e3) : e3;
}
function patchPrecision(e3, n3 = 13) {
  if (-1 === e3) return -1;
  if (n3 <= 0) return e3;
  if (isFunctionNode(e3)) return e3;
  const t3 = e3.value;
  if (!isTokenNumeric(t3)) return e3;
  if (Number.isInteger(t3[4].value)) return e3;
  const r3 = Number(t3[4].value.toFixed(n3)).toString();
  return isTokenNumber(t3) ? t3[1] = r3 : isTokenPercentage(t3) ? t3[1] = r3 + "%" : isTokenDimension(t3) && (t3[1] = r3 + t3[4].unit), e3;
}
function patchCanonicalUnit(e3) {
  return -1 === e3 ? -1 : isFunctionNode(e3) ? e3 : isTokenDimension(e3.value) ? (e3.value = toCanonicalUnit(e3.value), e3) : e3;
}
function patchCalcResult(e3, n3) {
  let t3 = e3;
  return n3?.toCanonicalUnits && (t3 = patchCanonicalUnit(t3)), t3 = patchPrecision(t3, n3?.precision), t3 = patchMinusZero(t3), n3?.censorIntoStandardRepresentableValues || (t3 = patchNaN(t3), t3 = patchInfinity(t3)), t3;
}
function tokenizeGlobals(e3) {
  const n3 = /* @__PURE__ */ new Map();
  if (!e3) return n3;
  for (const [t3, r3] of e3) if (isToken(r3)) n3.set(t3, r3);
  else if ("string" == typeof r3) {
    const e4 = tokenizer({ css: r3 }), a3 = e4.nextToken();
    if (e4.nextToken(), !e4.endOfFile()) continue;
    if (!isTokenNumeric(a3)) continue;
    n3.set(t3, a3);
    continue;
  }
  return n3;
}
function calc(e3, n3) {
  return calcFromComponentValues(parseCommaSeparatedListOfComponentValues(tokenize({ css: e3 }), {}), n3).map((e4) => e4.map((e5) => stringify(...e5.tokens())).join("")).join(",");
}
function calcFromComponentValues(e3, n3) {
  const t3 = tokenizeGlobals(n3?.globals);
  return replaceComponentValues2(e3, (e4) => {
    if (!isFunctionNode(e4)) return;
    const r3 = J.get(e4.getName().toLowerCase());
    if (!r3) return;
    const a3 = patchCalcResult(solve(r3(e4, t3, n3 ?? {}), n3 ?? {}), n3);
    return -1 !== a3 ? n3?.calcWrapper ? calcWrapper(e4, [a3]) : a3 : void 0;
  });
}
function replaceComponentValues2(n3, r3) {
  for (let a3 = 0; a3 < n3.length; a3++) {
    const o3 = n3[a3];
    walk(o3, (n4, a4) => {
      if ("number" != typeof a4) return;
      const o4 = r3(n4.node);
      if (!o4) return;
      const i3 = [o4], l3 = n4.parent.value[a4 - 1];
      isTokenNode(l3) && isTokenDelim(l3.value) && ("-" === l3.value[4].value || "+" === l3.value[4].value) && i3.splice(0, 0, new WhitespaceNode([[u.Whitespace, " ", ...sourceIndices(n4.node), void 0]]));
      const s4 = n4.parent.value[a4 + 1];
      !s4 || isWhiteSpaceOrCommentNode(s4) || isTokenNode(s4) && (isTokenComma(s4.value) || isTokenColon(s4.value) || isTokenSemicolon(s4.value) || isTokenDelim(s4.value) && "-" !== s4.value[4].value && "+" !== s4.value[4].value) || i3.push(new WhitespaceNode([[u.Whitespace, " ", ...sourceIndices(n4.node), void 0]])), n4.parent.value.splice(a4, 1, ...i3);
    });
  }
  return n3;
}
var Q = new Set(J.keys());

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/lru-cache/dist/esm/node/index.min.js
var import_node_diagnostics_channel = require("node:diagnostics_channel");
var S = (0, import_node_diagnostics_channel.channel)("lru-cache:metrics");
var W2 = (0, import_node_diagnostics_channel.tracingChannel)("lru-cache");
var L2 = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date;
var R2 = () => S.hasSubscribers || W2.hasSubscribers;
var U2 = /* @__PURE__ */ new Set();
var M2 = typeof process == "object" && process ? process : {};
var k2 = (d5, e3, t3, i3) => {
  typeof M2.emitWarning == "function" ? M2.emitWarning(d5, e3, t3, i3) : console.error(`[${t3}] ${e3}: ${d5}`);
};
var H2 = (d5) => !U2.has(d5);
var T2 = (d5) => !!d5 && d5 === Math.floor(d5) && d5 > 0 && isFinite(d5);
var j2 = (d5) => T2(d5) ? d5 <= Math.pow(2, 8) ? Uint8Array : d5 <= Math.pow(2, 16) ? Uint16Array : d5 <= Math.pow(2, 32) ? Uint32Array : d5 <= Number.MAX_SAFE_INTEGER ? O2 : null : null;
var O2 = class extends Array {
  constructor(e3) {
    super(e3), this.fill(0);
  }
};
var x2 = class d2 {
  heap;
  length;
  static #o = false;
  static create(e3) {
    let t3 = j2(e3);
    if (!t3) return [];
    d2.#o = true;
    let i3 = new d2(e3, t3);
    return d2.#o = false, i3;
  }
  constructor(e3, t3) {
    if (!d2.#o) throw new TypeError("instantiate Stack using Stack.create(n)");
    this.heap = new t3(e3), this.length = 0;
  }
  push(e3) {
    this.heap[this.length++] = e3;
  }
  pop() {
    return this.heap[--this.length];
  }
};
var I2 = class d3 {
  #o;
  #c;
  #S;
  #O;
  #w;
  #M;
  #I;
  #m;
  get perf() {
    return this.#m;
  }
  ttl;
  ttlResolution;
  ttlAutopurge;
  updateAgeOnGet;
  updateAgeOnHas;
  allowStale;
  noDisposeOnSet;
  noUpdateTTL;
  maxEntrySize;
  sizeCalculation;
  noDeleteOnFetchRejection;
  noDeleteOnStaleGet;
  allowStaleOnFetchAbort;
  allowStaleOnFetchRejection;
  ignoreFetchAbort;
  backgroundFetchSize;
  #n;
  #b;
  #s;
  #i;
  #t;
  #l;
  #u;
  #a;
  #h;
  #y;
  #r;
  #_;
  #F;
  #d;
  #g;
  #T;
  #U;
  #f;
  #D;
  static unsafeExposeInternals(e3) {
    return { starts: e3.#F, ttls: e3.#d, autopurgeTimers: e3.#g, sizes: e3.#_, keyMap: e3.#s, keyList: e3.#i, valList: e3.#t, next: e3.#l, prev: e3.#u, get head() {
      return e3.#a;
    }, get tail() {
      return e3.#h;
    }, free: e3.#y, isBackgroundFetch: (t3) => e3.#e(t3), backgroundFetch: (t3, i3, s4, n3) => e3.#P(t3, i3, s4, n3), moveToTail: (t3) => e3.#L(t3), indexes: (t3) => e3.#A(t3), rindexes: (t3) => e3.#z(t3), isStale: (t3) => e3.#p(t3) };
  }
  get max() {
    return this.#o;
  }
  get maxSize() {
    return this.#c;
  }
  get calculatedSize() {
    return this.#b;
  }
  get size() {
    return this.#n;
  }
  get fetchMethod() {
    return this.#M;
  }
  get memoMethod() {
    return this.#I;
  }
  get dispose() {
    return this.#S;
  }
  get onInsert() {
    return this.#O;
  }
  get disposeAfter() {
    return this.#w;
  }
  constructor(e3) {
    let { max: t3 = 0, ttl: i3, ttlResolution: s4 = 1, ttlAutopurge: n3, updateAgeOnGet: o3, updateAgeOnHas: l3, allowStale: h3, dispose: r3, onInsert: c4, disposeAfter: m3, noDisposeOnSet: _4, noUpdateTTL: u4, maxSize: g3 = 0, maxEntrySize: f4 = 0, sizeCalculation: y2, fetchMethod: a3, memoMethod: w2, noDeleteOnFetchRejection: F2, noDeleteOnStaleGet: b3, allowStaleOnFetchRejection: p2, allowStaleOnFetchAbort: A2, ignoreFetchAbort: z3, backgroundFetchSize: C3 = 1, perf: E2 } = e3;
    if (this.backgroundFetchSize = C3, E2 !== void 0 && typeof E2?.now != "function") throw new TypeError("perf option must have a now() method if specified");
    if (this.#m = E2 ?? L2, t3 !== 0 && !T2(t3)) throw new TypeError("max option must be a nonnegative integer");
    let v2 = t3 ? j2(t3) : Array;
    if (!v2) throw new Error("invalid max value: " + t3);
    if (this.#o = t3, this.#c = g3, this.maxEntrySize = f4 || this.#c, this.sizeCalculation = y2, this.sizeCalculation) {
      if (!this.#c && !this.maxEntrySize) throw new TypeError("cannot set sizeCalculation without setting maxSize or maxEntrySize");
      if (typeof this.sizeCalculation != "function") throw new TypeError("sizeCalculation set to non-function");
    }
    if (w2 !== void 0 && typeof w2 != "function") throw new TypeError("memoMethod must be a function if defined");
    if (this.#I = w2, a3 !== void 0 && typeof a3 != "function") throw new TypeError("fetchMethod must be a function if specified");
    if (this.#M = a3, this.#U = !!a3, this.#s = /* @__PURE__ */ new Map(), this.#i = Array.from({ length: t3 }).fill(void 0), this.#t = Array.from({ length: t3 }).fill(void 0), this.#l = new v2(t3), this.#u = new v2(t3), this.#a = 0, this.#h = 0, this.#y = x2.create(t3), this.#n = 0, this.#b = 0, typeof r3 == "function" && (this.#S = r3), typeof c4 == "function" && (this.#O = c4), typeof m3 == "function" ? (this.#w = m3, this.#r = []) : (this.#w = void 0, this.#r = void 0), this.#T = !!this.#S, this.#D = !!this.#O, this.#f = !!this.#w, this.noDisposeOnSet = !!_4, this.noUpdateTTL = !!u4, this.noDeleteOnFetchRejection = !!F2, this.allowStaleOnFetchRejection = !!p2, this.allowStaleOnFetchAbort = !!A2, this.ignoreFetchAbort = !!z3, this.maxEntrySize !== 0) {
      if (this.#c !== 0 && !T2(this.#c)) throw new TypeError("maxSize must be a positive integer if specified");
      if (!T2(this.maxEntrySize)) throw new TypeError("maxEntrySize must be a positive integer if specified");
      this.#X();
    }
    if (this.allowStale = !!h3, this.noDeleteOnStaleGet = !!b3, this.updateAgeOnGet = !!o3, this.updateAgeOnHas = !!l3, this.ttlResolution = T2(s4) || s4 === 0 ? s4 : 1, this.ttlAutopurge = !!n3, this.ttl = i3 || 0, this.ttl) {
      if (!T2(this.ttl)) throw new TypeError("ttl must be a positive integer if specified");
      this.#k();
    }
    if (this.#o === 0 && this.ttl === 0 && this.#c === 0) throw new TypeError("At least one of max, maxSize, or ttl is required");
    if (!this.ttlAutopurge && !this.#o && !this.#c) {
      let D3 = "LRU_CACHE_UNBOUNDED";
      H2(D3) && (U2.add(D3), k2("TTL caching without ttlAutopurge, max, or maxSize can result in unbounded memory consumption.", "UnboundedCacheWarning", D3, d3));
    }
  }
  getRemainingTTL(e3) {
    return this.#s.has(e3) ? 1 / 0 : 0;
  }
  #k() {
    let e3 = new O2(this.#o), t3 = new O2(this.#o);
    this.#d = e3, this.#F = t3;
    let i3 = this.ttlAutopurge ? Array.from({ length: this.#o }) : void 0;
    this.#g = i3, this.#H = (h3, r3, c4 = this.#m.now()) => {
      t3[h3] = r3 !== 0 ? c4 : 0, e3[h3] = r3, s4(h3, r3);
    }, this.#R = (h3) => {
      t3[h3] = e3[h3] !== 0 ? this.#m.now() : 0, s4(h3, e3[h3]);
    };
    let s4 = this.ttlAutopurge ? (h3, r3) => {
      if (i3?.[h3] && (clearTimeout(i3[h3]), i3[h3] = void 0), r3 && r3 !== 0 && i3) {
        let c4 = setTimeout(() => {
          this.#p(h3) ? (this.#E(this.#i[h3], "expire"), i3[h3] = void 0) : s4(h3, l3(h3));
        }, r3 + 1);
        c4.unref && c4.unref(), i3[h3] = c4;
      }
    } : () => {
    };
    this.#v = (h3, r3) => {
      if (e3[r3]) {
        let c4 = e3[r3], m3 = t3[r3];
        if (!c4 || !m3) return;
        h3.ttl = c4, h3.start = m3, h3.now = n3 || o3();
        let _4 = h3.now - m3;
        h3.remainingTTL = c4 - _4;
      }
    };
    let n3 = 0, o3 = () => {
      let h3 = this.#m.now();
      if (this.ttlResolution > 0) {
        n3 = h3;
        let r3 = setTimeout(() => n3 = 0, this.ttlResolution);
        r3.unref && r3.unref();
      }
      return h3;
    };
    this.getRemainingTTL = (h3) => {
      let r3 = this.#s.get(h3);
      return r3 === void 0 ? 0 : l3(r3);
    };
    let l3 = (h3) => {
      let r3 = e3[h3], c4 = t3[h3];
      if (!r3 || !c4) return 1 / 0;
      let m3 = (n3 || o3()) - c4;
      return r3 - m3;
    };
    this.#p = (h3) => {
      let r3 = t3[h3], c4 = e3[h3];
      return !!c4 && !!r3 && (n3 || o3()) - r3 > c4;
    };
  }
  #R = () => {
  };
  #v = () => {
  };
  #H = () => {
  };
  #p = () => false;
  #X() {
    let e3 = new O2(this.#o);
    this.#b = 0, this.#_ = e3, this.#x = (t3) => {
      this.#b -= e3[t3], e3[t3] = 0;
    }, this.#N = (t3, i3, s4, n3) => {
      if (!T2(s4)) {
        if (this.#e(i3)) return this.backgroundFetchSize;
        if (n3) {
          if (typeof n3 != "function") throw new TypeError("sizeCalculation must be a function");
          if (s4 = n3(i3, t3), !T2(s4)) throw new TypeError("sizeCalculation return invalid (expect positive integer)");
        } else throw new TypeError("invalid size value (must be positive integer). When maxSize or maxEntrySize is used, sizeCalculation or size must be set.");
      }
      return s4;
    }, this.#j = (t3, i3, s4) => {
      if (e3[t3] = i3, this.#c) {
        let n3 = this.#c - e3[t3];
        for (; this.#b > n3; ) this.#G(true);
      }
      this.#b += e3[t3], s4 && (s4.entrySize = i3, s4.totalCalculatedSize = this.#b);
    };
  }
  #x = (e3) => {
  };
  #j = (e3, t3, i3) => {
  };
  #N = (e3, t3, i3, s4) => {
    if (i3 || s4) throw new TypeError("cannot set size without setting maxSize or maxEntrySize on cache");
    return 0;
  };
  *#A({ allowStale: e3 = this.allowStale } = {}) {
    if (this.#n) for (let t3 = this.#h; this.#V(t3) && ((e3 || !this.#p(t3)) && (yield t3), t3 !== this.#a); ) t3 = this.#u[t3];
  }
  *#z({ allowStale: e3 = this.allowStale } = {}) {
    if (this.#n) for (let t3 = this.#a; this.#V(t3) && ((e3 || !this.#p(t3)) && (yield t3), t3 !== this.#h); ) t3 = this.#l[t3];
  }
  #V(e3) {
    return e3 !== void 0 && this.#s.get(this.#i[e3]) === e3;
  }
  *entries() {
    for (let e3 of this.#A()) this.#t[e3] !== void 0 && this.#i[e3] !== void 0 && !this.#e(this.#t[e3]) && (yield [this.#i[e3], this.#t[e3]]);
  }
  *rentries() {
    for (let e3 of this.#z()) this.#t[e3] !== void 0 && this.#i[e3] !== void 0 && !this.#e(this.#t[e3]) && (yield [this.#i[e3], this.#t[e3]]);
  }
  *keys() {
    for (let e3 of this.#A()) {
      let t3 = this.#i[e3];
      t3 !== void 0 && !this.#e(this.#t[e3]) && (yield t3);
    }
  }
  *rkeys() {
    for (let e3 of this.#z()) {
      let t3 = this.#i[e3];
      t3 !== void 0 && !this.#e(this.#t[e3]) && (yield t3);
    }
  }
  *values() {
    for (let e3 of this.#A()) this.#t[e3] !== void 0 && !this.#e(this.#t[e3]) && (yield this.#t[e3]);
  }
  *rvalues() {
    for (let e3 of this.#z()) this.#t[e3] !== void 0 && !this.#e(this.#t[e3]) && (yield this.#t[e3]);
  }
  [Symbol.iterator]() {
    return this.entries();
  }
  [Symbol.toStringTag] = "LRUCache";
  find(e3, t3 = {}) {
    for (let i3 of this.#A()) {
      let s4 = this.#t[i3], n3 = this.#e(s4) ? s4.__staleWhileFetching : s4;
      if (n3 !== void 0 && e3(n3, this.#i[i3], this)) return this.#C(this.#i[i3], t3);
    }
  }
  forEach(e3, t3 = this) {
    for (let i3 of this.#A()) {
      let s4 = this.#t[i3], n3 = this.#e(s4) ? s4.__staleWhileFetching : s4;
      n3 !== void 0 && e3.call(t3, n3, this.#i[i3], this);
    }
  }
  rforEach(e3, t3 = this) {
    for (let i3 of this.#z()) {
      let s4 = this.#t[i3], n3 = this.#e(s4) ? s4.__staleWhileFetching : s4;
      n3 !== void 0 && e3.call(t3, n3, this.#i[i3], this);
    }
  }
  purgeStale() {
    let e3 = false;
    for (let t3 of this.#z({ allowStale: true })) this.#p(t3) && (this.#E(this.#i[t3], "expire"), e3 = true);
    return e3;
  }
  info(e3) {
    let t3 = this.#s.get(e3);
    if (t3 === void 0) return;
    let i3 = this.#t[t3], s4 = this.#e(i3) ? i3.__staleWhileFetching : i3;
    if (s4 === void 0) return;
    let n3 = { value: s4 };
    if (this.#d && this.#F) {
      let o3 = this.#d[t3], l3 = this.#F[t3];
      if (o3 && l3) {
        let h3 = o3 - (this.#m.now() - l3);
        n3.ttl = h3, n3.start = Date.now();
      }
    }
    return this.#_ && (n3.size = this.#_[t3]), n3;
  }
  dump() {
    let e3 = [];
    for (let t3 of this.#A({ allowStale: true })) {
      let i3 = this.#i[t3], s4 = this.#t[t3], n3 = this.#e(s4) ? s4.__staleWhileFetching : s4;
      if (n3 === void 0 || i3 === void 0) continue;
      let o3 = { value: n3 };
      if (this.#d && this.#F) {
        o3.ttl = this.#d[t3];
        let l3 = this.#m.now() - this.#F[t3];
        o3.start = Math.floor(Date.now() - l3);
      }
      this.#_ && (o3.size = this.#_[t3]), e3.unshift([i3, o3]);
    }
    return e3;
  }
  load(e3) {
    this.clear();
    for (let [t3, i3] of e3) {
      if (i3.start) {
        let s4 = Date.now() - i3.start;
        i3.start = this.#m.now() - s4;
      }
      this.#W(t3, i3.value, i3);
    }
  }
  set(e3, t3, i3 = {}) {
    let { status: s4 = S.hasSubscribers ? {} : void 0 } = i3;
    i3.status = s4, s4 && (s4.op = "set", s4.key = e3, t3 !== void 0 && (s4.value = t3), s4.cache = this);
    let n3 = this.#W(e3, t3, i3);
    return s4 && S.hasSubscribers && S.publish(s4), n3;
  }
  #W(e3, t3, i3, s4) {
    let { ttl: n3 = this.ttl, start: o3, noDisposeOnSet: l3 = this.noDisposeOnSet, sizeCalculation: h3 = this.sizeCalculation, status: r3 } = i3, c4 = this.#e(t3);
    if (t3 === void 0) return r3 && (r3.set = "deleted"), this.delete(e3), this;
    let { noUpdateTTL: m3 = this.noUpdateTTL } = i3;
    r3 && !c4 && (r3.value = t3);
    let _4 = this.#N(e3, t3, i3.size || 0, h3, r3);
    if (this.maxEntrySize && _4 > this.maxEntrySize) return this.#E(e3, "set"), r3 && (r3.set = "miss", r3.maxEntrySizeExceeded = true), this;
    let u4 = this.#n === 0 ? void 0 : this.#s.get(e3);
    if (u4 === void 0) u4 = this.#n === 0 ? this.#h : this.#y.length !== 0 ? this.#y.pop() : this.#n === this.#o ? this.#G(false) : this.#n, this.#i[u4] = e3, this.#t[u4] = t3, this.#s.set(e3, u4), this.#l[this.#h] = u4, this.#u[u4] = this.#h, this.#h = u4, this.#n++, this.#j(u4, _4, r3), r3 && (r3.set = "add"), m3 = false, this.#D && !c4 && this.#O?.(t3, e3, "add");
    else {
      this.#L(u4);
      let g3 = this.#t[u4];
      if (t3 !== g3) {
        if (!l3) if (this.#e(g3)) {
          g3 !== s4 && g3.__abortController.abort(new Error("replaced"));
          let { __staleWhileFetching: f4 } = g3;
          f4 !== void 0 && f4 !== t3 && (this.#T && this.#S?.(f4, e3, "set"), this.#f && this.#r?.push([f4, e3, "set"]));
        } else this.#T && this.#S?.(g3, e3, "set"), this.#f && this.#r?.push([g3, e3, "set"]);
        if (this.#x(u4), this.#j(u4, _4, r3), this.#t[u4] = t3, !c4) {
          let f4 = g3 && this.#e(g3) ? g3.__staleWhileFetching : g3, y2 = f4 === void 0 ? "add" : t3 !== f4 ? "replace" : "update";
          r3 && (r3.set = y2, f4 !== void 0 && (r3.oldValue = f4)), this.#D && this.onInsert?.(t3, e3, y2);
        }
      } else c4 || (r3 && (r3.set = "update"), this.#D && this.onInsert?.(t3, e3, "update"));
    }
    if (n3 !== 0 && !this.#d && this.#k(), this.#d && (m3 || this.#H(u4, n3, o3), r3 && this.#v(r3, u4)), !l3 && this.#f && this.#r) {
      let g3 = this.#r, f4;
      for (; f4 = g3?.shift(); ) this.#w?.(...f4);
    }
    return this;
  }
  pop() {
    try {
      for (; this.#n; ) {
        let e3 = this.#t[this.#a];
        if (this.#G(true), this.#e(e3)) {
          if (e3.__staleWhileFetching) return e3.__staleWhileFetching;
        } else if (e3 !== void 0) return e3;
      }
    } finally {
      if (this.#f && this.#r) {
        let e3 = this.#r, t3;
        for (; t3 = e3?.shift(); ) this.#w?.(...t3);
      }
    }
  }
  #G(e3) {
    let t3 = this.#a, i3 = this.#i[t3], s4 = this.#t[t3], n3 = this.#e(s4);
    n3 && s4.__abortController.abort(new Error("evicted"));
    let o3 = n3 ? s4.__staleWhileFetching : s4;
    return (this.#T || this.#f) && o3 !== void 0 && (this.#T && this.#S?.(o3, i3, "evict"), this.#f && this.#r?.push([o3, i3, "evict"])), this.#x(t3), this.#g?.[t3] && (clearTimeout(this.#g[t3]), this.#g[t3] = void 0), e3 && (this.#i[t3] = void 0, this.#t[t3] = void 0, this.#y.push(t3)), this.#n === 1 ? (this.#a = this.#h = 0, this.#y.length = 0) : this.#a = this.#l[t3], this.#s.delete(i3), this.#n--, t3;
  }
  has(e3, t3 = {}) {
    let { status: i3 = S.hasSubscribers ? {} : void 0 } = t3;
    t3.status = i3, i3 && (i3.op = "has", i3.key = e3, i3.cache = this);
    let s4 = this.#Y(e3, t3);
    return S.hasSubscribers && S.publish(i3), s4;
  }
  #Y(e3, t3 = {}) {
    let { updateAgeOnHas: i3 = this.updateAgeOnHas, status: s4 } = t3, n3 = this.#s.get(e3);
    if (n3 !== void 0) {
      let o3 = this.#t[n3];
      if (this.#e(o3) && o3.__staleWhileFetching === void 0) return false;
      if (this.#p(n3)) s4 && (s4.has = "stale", this.#v(s4, n3));
      else return i3 && this.#R(n3), s4 && (s4.has = "hit", this.#v(s4, n3)), true;
    } else s4 && (s4.has = "miss");
    return false;
  }
  peek(e3, t3 = {}) {
    let { status: i3 = R2() ? {} : void 0 } = t3;
    i3 && (i3.op = "peek", i3.key = e3, i3.cache = this), t3.status = i3;
    let s4 = this.#J(e3, t3);
    return S.hasSubscribers && S.publish(i3), s4;
  }
  #J(e3, t3) {
    let { status: i3, allowStale: s4 = this.allowStale } = t3, n3 = this.#s.get(e3);
    if (n3 === void 0 || !s4 && this.#p(n3)) {
      i3 && (i3.peek = n3 === void 0 ? "miss" : "stale");
      return;
    }
    let o3 = this.#t[n3], l3 = this.#e(o3) ? o3.__staleWhileFetching : o3;
    return i3 && (l3 !== void 0 ? (i3.peek = "hit", i3.value = l3) : i3.peek = "miss"), l3;
  }
  #P(e3, t3, i3, s4) {
    let n3 = t3 === void 0 ? void 0 : this.#t[t3];
    if (this.#e(n3)) return n3;
    let o3 = new AbortController(), { signal: l3 } = i3;
    l3?.addEventListener("abort", () => o3.abort(l3.reason), { signal: o3.signal });
    let h3 = { signal: o3.signal, options: i3, context: s4 }, r3 = (f4, y2 = false) => {
      let { aborted: a3 } = o3.signal, w2 = i3.ignoreFetchAbort && f4 !== void 0, F2 = i3.ignoreFetchAbort || !!(i3.allowStaleOnFetchAbort && f4 !== void 0);
      if (i3.status && (a3 && !y2 ? (i3.status.fetchAborted = true, i3.status.fetchError = o3.signal.reason, w2 && (i3.status.fetchAbortIgnored = true)) : i3.status.fetchResolved = true), a3 && !w2 && !y2) return m3(o3.signal.reason, F2);
      let b3 = u4, p2 = this.#t[t3];
      return (p2 === u4 || p2 === void 0 && w2 && y2) && (f4 === void 0 ? b3.__staleWhileFetching !== void 0 ? this.#t[t3] = b3.__staleWhileFetching : this.#E(e3, "fetch") : (i3.status && (i3.status.fetchUpdated = true), this.#W(e3, f4, h3.options, b3))), f4;
    }, c4 = (f4) => (i3.status && (i3.status.fetchRejected = true, i3.status.fetchError = f4), m3(f4, false)), m3 = (f4, y2) => {
      let { aborted: a3 } = o3.signal, w2 = a3 && i3.allowStaleOnFetchAbort, F2 = w2 || i3.allowStaleOnFetchRejection, b3 = F2 || i3.noDeleteOnFetchRejection, p2 = u4;
      if (this.#t[t3] === u4 && (!b3 || !y2 && p2.__staleWhileFetching === void 0 ? this.#E(e3, "fetch") : w2 || (this.#t[t3] = p2.__staleWhileFetching)), F2) return i3.status && p2.__staleWhileFetching !== void 0 && (i3.status.returnedStale = true), p2.__staleWhileFetching;
      if (p2.__returned === p2) throw f4;
    }, _4 = (f4, y2) => {
      let a3 = this.#M?.(e3, n3, h3);
      o3.signal.addEventListener("abort", () => {
        (!i3.ignoreFetchAbort || i3.allowStaleOnFetchAbort) && (f4(void 0), i3.allowStaleOnFetchAbort && (f4 = (w2) => r3(w2, true)));
      }), a3 && a3 instanceof Promise ? a3.then((w2) => f4(w2 === void 0 ? void 0 : w2), y2) : a3 !== void 0 && f4(a3);
    };
    i3.status && (i3.status.fetchDispatched = true);
    let u4 = new Promise(_4).then(r3, c4), g3 = Object.assign(u4, { __abortController: o3, __staleWhileFetching: n3, __returned: void 0 });
    return t3 === void 0 ? (this.#W(e3, g3, { ...h3.options, status: void 0 }), t3 = this.#s.get(e3)) : this.#t[t3] = g3, g3;
  }
  #e(e3) {
    if (!this.#U) return false;
    let t3 = e3;
    return !!t3 && t3 instanceof Promise && t3.hasOwnProperty("__staleWhileFetching") && t3.__abortController instanceof AbortController;
  }
  fetch(e3, t3 = {}) {
    let i3 = W2.hasSubscribers, { status: s4 = R2() ? {} : void 0 } = t3;
    t3.status = s4, s4 && t3.context && (s4.context = t3.context);
    let n3 = this.#B(e3, t3);
    return s4 && i3 && (s4.trace = true, W2.tracePromise(() => n3, s4).catch(() => {
    })), n3;
  }
  async #B(e3, t3 = {}) {
    let { allowStale: i3 = this.allowStale, updateAgeOnGet: s4 = this.updateAgeOnGet, noDeleteOnStaleGet: n3 = this.noDeleteOnStaleGet, ttl: o3 = this.ttl, noDisposeOnSet: l3 = this.noDisposeOnSet, size: h3 = 0, sizeCalculation: r3 = this.sizeCalculation, noUpdateTTL: c4 = this.noUpdateTTL, noDeleteOnFetchRejection: m3 = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection: _4 = this.allowStaleOnFetchRejection, ignoreFetchAbort: u4 = this.ignoreFetchAbort, allowStaleOnFetchAbort: g3 = this.allowStaleOnFetchAbort, context: f4, forceRefresh: y2 = false, status: a3, signal: w2 } = t3;
    if (a3 && (a3.op = "fetch", a3.key = e3, y2 && (a3.forceRefresh = true), a3.cache = this), !this.#U) return a3 && (a3.fetch = "get"), this.#C(e3, { allowStale: i3, updateAgeOnGet: s4, noDeleteOnStaleGet: n3, status: a3 });
    let F2 = { allowStale: i3, updateAgeOnGet: s4, noDeleteOnStaleGet: n3, ttl: o3, noDisposeOnSet: l3, size: h3, sizeCalculation: r3, noUpdateTTL: c4, noDeleteOnFetchRejection: m3, allowStaleOnFetchRejection: _4, allowStaleOnFetchAbort: g3, ignoreFetchAbort: u4, status: a3, signal: w2 }, b3 = this.#s.get(e3);
    if (b3 === void 0) {
      a3 && (a3.fetch = "miss");
      let p2 = this.#P(e3, b3, F2, f4);
      return p2.__returned = p2;
    } else {
      let p2 = this.#t[b3];
      if (this.#e(p2)) {
        let v2 = i3 && p2.__staleWhileFetching !== void 0;
        return a3 && (a3.fetch = "inflight", v2 && (a3.returnedStale = true)), v2 ? p2.__staleWhileFetching : p2.__returned = p2;
      }
      let A2 = this.#p(b3);
      if (!y2 && !A2) return a3 && (a3.fetch = "hit"), this.#L(b3), s4 && this.#R(b3), a3 && this.#v(a3, b3), p2;
      let z3 = this.#P(e3, b3, F2, f4), E2 = z3.__staleWhileFetching !== void 0 && i3;
      return a3 && (a3.fetch = A2 ? "stale" : "refresh", E2 && A2 && (a3.returnedStale = true)), E2 ? z3.__staleWhileFetching : z3.__returned = z3;
    }
  }
  forceFetch(e3, t3 = {}) {
    let i3 = W2.hasSubscribers, { status: s4 = R2() ? {} : void 0 } = t3;
    t3.status = s4, s4 && t3.context && (s4.context = t3.context);
    let n3 = this.#K(e3, t3);
    return s4 && i3 && (s4.trace = true, W2.tracePromise(() => n3, s4).catch(() => {
    })), n3;
  }
  async #K(e3, t3 = {}) {
    let i3 = await this.#B(e3, t3);
    if (i3 === void 0) throw new Error("fetch() returned undefined");
    return i3;
  }
  memo(e3, t3 = {}) {
    let { status: i3 = S.hasSubscribers ? {} : void 0 } = t3;
    t3.status = i3, i3 && (i3.op = "memo", i3.key = e3, t3.context && (i3.context = t3.context), i3.cache = this);
    let s4 = this.#Q(e3, t3);
    return i3 && (i3.value = s4), S.hasSubscribers && S.publish(i3), s4;
  }
  #Q(e3, t3 = {}) {
    let i3 = this.#I;
    if (!i3) throw new Error("no memoMethod provided to constructor");
    let { context: s4, status: n3, forceRefresh: o3, ...l3 } = t3;
    n3 && o3 && (n3.forceRefresh = true);
    let h3 = this.#C(e3, l3), r3 = o3 || h3 === void 0;
    if (n3 && (n3.memo = r3 ? "miss" : "hit", r3 || (n3.value = h3)), !r3) return h3;
    let c4 = i3(e3, h3, { options: l3, context: s4 });
    return n3 && (n3.value = c4), this.#W(e3, c4, l3), c4;
  }
  get(e3, t3 = {}) {
    let { status: i3 = S.hasSubscribers ? {} : void 0 } = t3;
    t3.status = i3, i3 && (i3.op = "get", i3.key = e3, i3.cache = this);
    let s4 = this.#C(e3, t3);
    return i3 && (s4 !== void 0 && (i3.value = s4), S.hasSubscribers && S.publish(i3)), s4;
  }
  #C(e3, t3 = {}) {
    let { allowStale: i3 = this.allowStale, updateAgeOnGet: s4 = this.updateAgeOnGet, noDeleteOnStaleGet: n3 = this.noDeleteOnStaleGet, status: o3 } = t3, l3 = this.#s.get(e3);
    if (l3 === void 0) {
      o3 && (o3.get = "miss");
      return;
    }
    let h3 = this.#t[l3], r3 = this.#e(h3);
    return o3 && this.#v(o3, l3), this.#p(l3) ? r3 ? (o3 && (o3.get = "stale-fetching"), i3 && h3.__staleWhileFetching !== void 0 ? (o3 && (o3.returnedStale = true), h3.__staleWhileFetching) : void 0) : (n3 || this.#E(e3, "expire"), o3 && (o3.get = "stale"), i3 ? (o3 && (o3.returnedStale = true), h3) : void 0) : (o3 && (o3.get = r3 ? "fetching" : "hit"), this.#L(l3), s4 && this.#R(l3), r3 ? h3.__staleWhileFetching : h3);
  }
  #$(e3, t3) {
    this.#u[t3] = e3, this.#l[e3] = t3;
  }
  #L(e3) {
    e3 !== this.#h && (e3 === this.#a ? this.#a = this.#l[e3] : this.#$(this.#u[e3], this.#l[e3]), this.#$(this.#h, e3), this.#h = e3);
  }
  delete(e3) {
    return this.#E(e3, "delete");
  }
  #E(e3, t3) {
    S.hasSubscribers && S.publish({ op: "delete", delete: t3, key: e3, cache: this });
    let i3 = false;
    if (this.#n !== 0) {
      let s4 = this.#s.get(e3);
      if (s4 !== void 0) if (this.#g?.[s4] && (clearTimeout(this.#g[s4]), this.#g[s4] = void 0), i3 = true, this.#n === 1) this.#q(t3);
      else {
        this.#x(s4);
        let n3 = this.#t[s4];
        if (this.#e(n3) ? n3.__abortController.abort(new Error("deleted")) : (this.#T || this.#f) && (this.#T && this.#S?.(n3, e3, t3), this.#f && this.#r?.push([n3, e3, t3])), this.#s.delete(e3), this.#i[s4] = void 0, this.#t[s4] = void 0, s4 === this.#h) this.#h = this.#u[s4];
        else if (s4 === this.#a) this.#a = this.#l[s4];
        else {
          let o3 = this.#u[s4];
          this.#l[o3] = this.#l[s4];
          let l3 = this.#l[s4];
          this.#u[l3] = this.#u[s4];
        }
        this.#n--, this.#y.push(s4);
      }
    }
    if (this.#f && this.#r?.length) {
      let s4 = this.#r, n3;
      for (; n3 = s4?.shift(); ) this.#w?.(...n3);
    }
    return i3;
  }
  clear() {
    return this.#q("delete");
  }
  #q(e3) {
    for (let t3 of this.#z({ allowStale: true })) {
      let i3 = this.#t[t3];
      if (this.#e(i3)) i3.__abortController.abort(new Error("deleted"));
      else {
        let s4 = this.#i[t3];
        this.#T && this.#S?.(i3, s4, e3), this.#f && this.#r?.push([i3, s4, e3]);
      }
    }
    if (this.#s.clear(), this.#t.fill(void 0), this.#i.fill(void 0), this.#d && this.#F) {
      this.#d.fill(0), this.#F.fill(0);
      for (let t3 of this.#g ?? []) t3 !== void 0 && clearTimeout(t3);
      this.#g?.fill(void 0);
    }
    if (this.#_ && this.#_.fill(0), this.#a = 0, this.#h = 0, this.#y.length = 0, this.#b = 0, this.#n = 0, this.#f && this.#r) {
      let t3 = this.#r, i3;
      for (; i3 = t3?.shift(); ) this.#w?.(...i3);
    }
  }
};

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@csstools/color-helpers/dist/index.mjs
function multiplyMatrices(_4, t3) {
  return [_4[0] * t3[0] + _4[1] * t3[1] + _4[2] * t3[2], _4[3] * t3[0] + _4[4] * t3[1] + _4[5] * t3[2], _4[6] * t3[0] + _4[7] * t3[1] + _4[8] * t3[2]];
}
var _2 = [0.955473421488075, -0.02309845494876471, 0.06325924320057072, -0.0283697093338637, 1.0099953980813041, 0.021041441191917323, 0.012314014864481998, -0.020507649298898964, 1.330365926242124];
function D50_to_D65(t3) {
  return multiplyMatrices(_2, t3);
}
var t2 = [1.0479297925449969, 0.022946870601609652, -0.05019226628920524, 0.02962780877005599, 0.9904344267538799, -0.017073799063418826, -0.009243040646204504, 0.015055191490298152, 0.7518742814281371];
function D65_to_D50(_4) {
  return multiplyMatrices(t2, _4);
}
function HSL_to_sRGB(_4) {
  let t3 = _4[0] % 360;
  const n3 = _4[1] / 100, o3 = _4[2] / 100;
  return t3 < 0 && (t3 += 360), [HSL_to_sRGB_channel(0, t3, n3, o3), HSL_to_sRGB_channel(8, t3, n3, o3), HSL_to_sRGB_channel(4, t3, n3, o3)];
}
function HSL_to_sRGB_channel(_4, t3, n3, o3) {
  const e3 = (_4 + t3 / 30) % 12;
  return o3 - n3 * Math.min(o3, 1 - o3) * Math.max(-1, Math.min(e3 - 3, 9 - e3, 1));
}
function HWB_to_sRGB(_4) {
  const t3 = _4[0], n3 = _4[1] / 100, o3 = _4[2] / 100;
  if (n3 + o3 >= 1) {
    const _5 = n3 / (n3 + o3);
    return [_5, _5, _5];
  }
  const e3 = HSL_to_sRGB([t3, 100, 50]), r3 = 1 - n3 - o3;
  return [e3[0] * r3 + n3, e3[1] * r3 + n3, e3[2] * r3 + n3];
}
function LCH_to_Lab(_4) {
  const t3 = _4[2] * Math.PI / 180;
  return [_4[0], _4[1] * Math.cos(t3), _4[1] * Math.sin(t3)];
}
function Lab_to_LCH(_4) {
  const t3 = Math.sqrt(Math.pow(_4[1], 2) + Math.pow(_4[2], 2));
  let n3 = 180 * Math.atan2(_4[2], _4[1]) / Math.PI;
  return n3 < 0 && (n3 += 360), t3 <= 15e-4 && (n3 = NaN), [_4[0], t3, n3];
}
var n2 = [0.3457 / 0.3585, 1, 0.2958 / 0.3585];
function Lab_to_XYZ(_4) {
  const t3 = 24389 / 27, o3 = 216 / 24389, e3 = (_4[0] + 16) / 116, r3 = _4[1] / 500 + e3, a3 = e3 - _4[2] / 200;
  return [(Math.pow(r3, 3) > o3 ? Math.pow(r3, 3) : (116 * r3 - 16) / t3) * n2[0], (_4[0] > 8 ? Math.pow((_4[0] + 16) / 116, 3) : _4[0] / t3) * n2[1], (Math.pow(a3, 3) > o3 ? Math.pow(a3, 3) : (116 * a3 - 16) / t3) * n2[2]];
}
function OKLCH_to_OKLab(_4) {
  const t3 = _4[2] * Math.PI / 180;
  return [_4[0], _4[1] * Math.cos(t3), _4[1] * Math.sin(t3)];
}
function OKLab_to_OKLCH(_4) {
  const t3 = Math.sqrt(_4[1] ** 2 + _4[2] ** 2);
  let n3 = 180 * Math.atan2(_4[2], _4[1]) / Math.PI;
  return n3 < 0 && (n3 += 360), t3 <= 4e-6 && (n3 = NaN), [_4[0], t3, n3];
}
var o2 = [1.2268798758459243, -0.5578149944602171, 0.2813910456659647, -0.0405757452148008, 1.112286803280317, -0.0717110580655164, -0.0763729366746601, -0.4214933324022432, 1.5869240198367816];
var e2 = [1, 0.3963377773761749, 0.2158037573099136, 1, -0.1055613458156586, -0.0638541728258133, 1, -0.0894841775298119, -1.2914855480194092];
function OKLab_to_XYZ(_4) {
  const t3 = multiplyMatrices(e2, _4);
  return multiplyMatrices(o2, [t3[0] ** 3, t3[1] ** 3, t3[2] ** 3]);
}
function XYZ_to_Lab(_4) {
  const t3 = compute_f(_4[0] / n2[0]), o3 = compute_f(_4[1] / n2[1]);
  return [116 * o3 - 16, 500 * (t3 - o3), 200 * (o3 - compute_f(_4[2] / n2[2]))];
}
var r2 = 216 / 24389;
var a2 = 24389 / 27;
function compute_f(_4) {
  return _4 > r2 ? Math.cbrt(_4) : (a2 * _4 + 16) / 116;
}
var i2 = [0.819022437996703, 0.3619062600528904, -0.1288737815209879, 0.0329836539323885, 0.9292868615863434, 0.0361446663506424, 0.0481771893596242, 0.2642395317527308, 0.6335478284694309];
var l = [0.210454268309314, 0.7936177747023054, -0.0040720430116193, 1.9779985324311684, -2.42859224204858, 0.450593709617411, 0.0259040424655478, 0.7827717124575296, -0.8086757549230774];
function XYZ_to_OKLab(_4) {
  const t3 = multiplyMatrices(i2, _4);
  return multiplyMatrices(l, [Math.cbrt(t3[0]), Math.cbrt(t3[1]), Math.cbrt(t3[2])]);
}
var u2 = [30757411 / 17917100, -6372589 / 17917100, -4539589 / 17917100, -0.666684351832489, 1.616481236634939, 467509 / 29648200, 792561 / 44930125, -1921689 / 44930125, 0.942103121235474];
function XYZ_to_lin_2020(_4) {
  return multiplyMatrices(u2, _4);
}
var c2 = [446124 / 178915, -333277 / 357830, -72051 / 178915, -14852 / 17905, 63121 / 35810, 423 / 17905, 11844 / 330415, -50337 / 660830, 316169 / 330415];
function XYZ_to_lin_P3(_4) {
  return multiplyMatrices(c2, _4);
}
var s2 = [1.3457868816471583, -0.25557208737979464, -0.05110186497554526, -0.5446307051249019, 1.5082477428451468, 0.02052744743642139, 0, 0, 1.2119675456389452];
function XYZ_to_lin_ProPhoto(_4) {
  return multiplyMatrices(s2, _4);
}
var X = [1829569 / 896150, -506331 / 896150, -308931 / 896150, -851781 / 878810, 1648619 / 878810, 36519 / 878810, 16779 / 1248040, -147721 / 1248040, 1266979 / 1248040];
function XYZ_to_lin_a98rgb(_4) {
  return multiplyMatrices(X, _4);
}
var Y2 = [12831 / 3959, -329 / 214, -1974 / 3959, -851781 / 878810, 1648619 / 878810, 36519 / 878810, 705 / 12673, -2585 / 12673, 705 / 667];
function XYZ_to_lin_sRGB(_4) {
  return multiplyMatrices(Y2, _4);
}
function gam_2020(_4) {
  return [gam_2020_channel(_4[0]), gam_2020_channel(_4[1]), gam_2020_channel(_4[2])];
}
function gam_2020_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return t3 * Math.pow(n3, 1 / 2.4);
}
function gam_sRGB(_4) {
  return [gam_sRGB_channel(_4[0]), gam_sRGB_channel(_4[1]), gam_sRGB_channel(_4[2])];
}
function gam_sRGB_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return n3 > 31308e-7 ? t3 * (1.055 * Math.pow(n3, 1 / 2.4) - 0.055) : 12.92 * _4;
}
function gam_P3(_4) {
  return gam_sRGB(_4);
}
function gam_ProPhoto(_4) {
  return [gam_ProPhoto_channel(_4[0]), gam_ProPhoto_channel(_4[1]), gam_ProPhoto_channel(_4[2])];
}
var Z2 = 1 / 512;
function gam_ProPhoto_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return n3 >= Z2 ? t3 * Math.pow(n3, 1 / 1.8) : 16 * _4;
}
function gam_a98rgb(_4) {
  return [gam_a98rgb_channel(_4[0]), gam_a98rgb_channel(_4[1]), gam_a98rgb_channel(_4[2])];
}
function gam_a98rgb_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return t3 * Math.pow(n3, 256 / 563);
}
function lin_2020(_4) {
  return [lin_2020_channel(_4[0]), lin_2020_channel(_4[1]), lin_2020_channel(_4[2])];
}
function lin_2020_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return t3 * Math.pow(n3, 2.4);
}
var D = [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314, 26158966 / 99577255, 0.677998071518871, 8267143 / 139408157, 0, 19567812 / 697040785, 1.0609850577107909];
function lin_2020_to_XYZ(_4) {
  return multiplyMatrices(D, _4);
}
function lin_sRGB(_4) {
  return [lin_sRGB_channel(_4[0]), lin_sRGB_channel(_4[1]), lin_sRGB_channel(_4[2])];
}
function lin_sRGB_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return n3 <= 0.04045 ? _4 / 12.92 : t3 * Math.pow((n3 + 0.055) / 1.055, 2.4);
}
function lin_P3(_4) {
  return lin_sRGB(_4);
}
var h = [608311 / 1250200, 189793 / 714400, 198249 / 1000160, 35783 / 156275, 247089 / 357200, 198249 / 2500400, 0, 32229 / 714400, 5220557 / 5000800];
function lin_P3_to_XYZ(_4) {
  return multiplyMatrices(h, _4);
}
function lin_ProPhoto(_4) {
  return [lin_ProPhoto_channel(_4[0]), lin_ProPhoto_channel(_4[1]), lin_ProPhoto_channel(_4[2])];
}
var f2 = 16 / 512;
function lin_ProPhoto_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return n3 <= f2 ? _4 / 16 : t3 * Math.pow(n3, 1.8);
}
var m = [0.7977666449006423, 0.13518129740053308, 0.0313477341283922, 0.2880748288194013, 0.711835234241873, 8993693872564e-17, 0, 0, 0.8251046025104602];
function lin_ProPhoto_to_XYZ(_4) {
  return multiplyMatrices(m, _4);
}
function lin_a98rgb(_4) {
  return [lin_a98rgb_channel(_4[0]), lin_a98rgb_channel(_4[1]), lin_a98rgb_channel(_4[2])];
}
function lin_a98rgb_channel(_4) {
  const t3 = _4 < 0 ? -1 : 1, n3 = Math.abs(_4);
  return t3 * Math.pow(n3, 563 / 256);
}
var b = [573536 / 994567, 263643 / 1420810, 187206 / 994567, 591459 / 1989134, 6239551 / 9945670, 374412 / 4972835, 53769 / 1989134, 351524 / 4972835, 4929758 / 4972835];
function lin_a98rgb_to_XYZ(_4) {
  return multiplyMatrices(b, _4);
}
var g = [506752 / 1228815, 87881 / 245763, 12673 / 70218, 87098 / 409605, 175762 / 245763, 12673 / 175545, 7918 / 409605, 87881 / 737289, 1001167 / 1053270];
function lin_sRGB_to_XYZ(_4) {
  return multiplyMatrices(g, _4);
}
function sRGB_to_HSL(_4) {
  const t3 = _4[0], n3 = _4[1], o3 = _4[2], e3 = Math.max(t3, n3, o3), r3 = Math.min(t3, n3, o3), a3 = (r3 + e3) / 2, i3 = e3 - r3;
  let l3 = Number.NaN, u4 = 0;
  if (0 !== Math.round(1e5 * i3)) {
    const _5 = Math.round(1e5 * a3);
    switch (u4 = 0 === _5 || 1e5 === _5 ? 0 : (e3 - a3) / Math.min(a3, 1 - a3), e3) {
      case t3:
        l3 = (n3 - o3) / i3 + (n3 < o3 ? 6 : 0);
        break;
      case n3:
        l3 = (o3 - t3) / i3 + 2;
        break;
      case o3:
        l3 = (t3 - n3) / i3 + 4;
    }
    l3 *= 60;
  }
  u4 < 0 && (l3 += 180, u4 = Math.abs(u4)), l3 >= 360 && (l3 -= 360);
  return u4 <= 1e-5 && (l3 = NaN), [l3, 100 * u4, 100 * a3];
}
function sRGB_to_Hue(_4) {
  const t3 = _4[0], n3 = _4[1], o3 = _4[2], e3 = Math.max(t3, n3, o3), r3 = Math.min(t3, n3, o3);
  let a3 = Number.NaN;
  const i3 = e3 - r3;
  if (0 !== i3) {
    switch (e3) {
      case t3:
        a3 = (n3 - o3) / i3 + (n3 < o3 ? 6 : 0);
        break;
      case n3:
        a3 = (o3 - t3) / i3 + 2;
        break;
      case o3:
        a3 = (t3 - n3) / i3 + 4;
    }
    a3 *= 60;
  }
  return a3 >= 360 && (a3 -= 360), a3;
}
function sRGB_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function HSL_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = HSL_to_sRGB(t3), t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function HWB_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = HWB_to_sRGB(t3), t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function Lab_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = Lab_to_XYZ(t3), t3;
}
function XYZ_D50_to_Lab(_4) {
  let t3 = _4;
  return t3 = XYZ_to_Lab(t3), t3;
}
function LCH_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = LCH_to_Lab(t3), t3 = Lab_to_XYZ(t3), t3;
}
function XYZ_D50_to_LCH(_4) {
  let t3 = _4;
  return t3 = XYZ_to_Lab(t3), t3 = Lab_to_LCH(t3), t3;
}
function OKLab_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = OKLab_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function OKLCH_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = OKLCH_to_OKLab(t3), t3 = OKLab_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function lin_sRGB_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_sRGB_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function a98_RGB_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_a98rgb(t3), t3 = lin_a98rgb_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function P3_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_P3(t3), t3 = lin_P3_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function lin_P3_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_P3_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function rec_2020_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_2020(t3), t3 = lin_2020_to_XYZ(t3), t3 = D65_to_D50(t3), t3;
}
function ProPhoto_RGB_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = lin_ProPhoto(t3), t3 = lin_ProPhoto_to_XYZ(t3), t3;
}
function XYZ_D50_to_ProPhoto(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_ProPhoto(t3), t3 = gam_ProPhoto(t3), t3;
}
function XYZ_D65_to_XYZ_D50(_4) {
  let t3 = _4;
  return t3 = D65_to_D50(t3), t3;
}
function XYZ_D50_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = D50_to_D65(t3), t3;
}
function XYZ_D50_to_XYZ_D50(_4) {
  return _4;
}
function XYZ_D65_to_XYZ_D65(_4) {
  return _4;
}
function sRGB_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3;
}
function XYZ_D65_to_sRGB(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_sRGB(t3), t3 = gam_sRGB(t3), t3;
}
function HSL_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = HSL_to_sRGB(t3), t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3;
}
function XYZ_D65_to_HSL(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_sRGB(t3), t3 = gam_sRGB(t3), t3 = sRGB_to_HSL(t3), t3;
}
function HWB_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = HWB_to_sRGB(t3), t3 = lin_sRGB(t3), t3 = lin_sRGB_to_XYZ(t3), t3;
}
function XYZ_D65_to_HWB(_4) {
  let t3 = _4;
  t3 = XYZ_to_lin_sRGB(t3);
  const n3 = gam_sRGB(t3), o3 = Math.min(n3[0], n3[1], n3[2]), e3 = 1 - Math.max(n3[0], n3[1], n3[2]);
  let r3 = sRGB_to_Hue(n3);
  return o3 + e3 >= 0.99999 && (r3 = NaN), [r3, 100 * o3, 100 * e3];
}
function Lab_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = Lab_to_XYZ(t3), t3 = D50_to_D65(t3), t3;
}
function LCH_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = LCH_to_Lab(t3), t3 = Lab_to_XYZ(t3), t3 = D50_to_D65(t3), t3;
}
function OKLab_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = OKLab_to_XYZ(t3), t3;
}
function XYZ_D65_to_OKLab(_4) {
  let t3 = _4;
  return t3 = XYZ_to_OKLab(t3), t3;
}
function OKLCH_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = OKLCH_to_OKLab(t3), t3 = OKLab_to_XYZ(t3), t3;
}
function XYZ_D65_to_OKLCH(_4) {
  let t3 = _4;
  return t3 = XYZ_to_OKLab(t3), t3 = OKLab_to_OKLCH(t3), t3;
}
function lin_sRGB_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_sRGB_to_XYZ(t3), t3;
}
function XYZ_D65_to_lin_sRGB(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_sRGB(t3), t3;
}
function a98_RGB_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_a98rgb(t3), t3 = lin_a98rgb_to_XYZ(t3), t3;
}
function XYZ_D65_to_a98_RGB(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_a98rgb(t3), t3 = gam_a98rgb(t3), t3;
}
function P3_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_P3(t3), t3 = lin_P3_to_XYZ(t3), t3;
}
function XYZ_D65_to_P3(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_P3(t3), t3 = gam_P3(t3), t3;
}
function lin_P3_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_P3_to_XYZ(t3), t3;
}
function XYZ_D65_to_lin_P3(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_P3(t3), t3;
}
function rec_2020_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_2020(t3), t3 = lin_2020_to_XYZ(t3), t3;
}
function XYZ_D65_to_rec_2020(_4) {
  let t3 = _4;
  return t3 = XYZ_to_lin_2020(t3), t3 = gam_2020(t3), t3;
}
function ProPhoto_RGB_to_XYZ_D65(_4) {
  let t3 = _4;
  return t3 = lin_ProPhoto(t3), t3 = lin_ProPhoto_to_XYZ(t3), t3 = D50_to_D65(t3), t3;
}
function inGamut(_4) {
  return _4[0] >= -1e-4 && _4[0] <= 1.0001 && _4[1] >= -1e-4 && _4[1] <= 1.0001 && _4[2] >= -1e-4 && _4[2] <= 1.0001;
}
function clip(_4) {
  return [_4[0] < 0 ? 0 : _4[0] > 1 ? 1 : _4[0], _4[1] < 0 ? 0 : _4[1] > 1 ? 1 : _4[1], _4[2] < 0 ? 0 : _4[2] > 1 ? 1 : _4[2]];
}
function mapGamutRayTrace(_4, t3, n3) {
  const o3 = _4[0], e3 = _4[2];
  let r3 = t3(_4);
  const a3 = t3([o3, 0, e3]);
  for (let _5 = 0; _5 < 4; _5++) {
    if (_5 > 0) {
      const _6 = n3(r3);
      _6[0] = o3, _6[2] = e3, r3 = t3(_6);
    }
    const i3 = rayTraceBox(a3, r3);
    if (!i3) break;
    r3 = i3;
  }
  return clip(r3);
}
function rayTraceBox(_4, t3) {
  let n3 = 1 / 0, o3 = -1 / 0;
  const e3 = [0, 0, 0];
  for (let r3 = 0; r3 < 3; r3++) {
    const a3 = _4[r3], i3 = t3[r3] - a3;
    e3[r3] = i3;
    const l3 = 0, u4 = 1;
    if (Math.abs(i3) > 1e-12) {
      const _5 = 1 / i3, t4 = (l3 - a3) * _5, e4 = (u4 - a3) * _5;
      o3 = Math.max(Math.min(t4, e4), o3), n3 = Math.min(Math.max(t4, e4), n3);
    } else if (a3 < l3 || a3 > u4) return false;
  }
  return !(o3 > n3 || n3 < 0) && (o3 < 0 && (o3 = n3), !!isFinite(o3) && [_4[0] + e3[0] * o3, _4[1] + e3[1] * o3, _4[2] + e3[2] * o3]);
}
var G3 = { aliceblue: [240, 248, 255], antiquewhite: [250, 235, 215], aqua: [0, 255, 255], aquamarine: [127, 255, 212], azure: [240, 255, 255], beige: [245, 245, 220], bisque: [255, 228, 196], black: [0, 0, 0], blanchedalmond: [255, 235, 205], blue: [0, 0, 255], blueviolet: [138, 43, 226], brown: [165, 42, 42], burlywood: [222, 184, 135], cadetblue: [95, 158, 160], chartreuse: [127, 255, 0], chocolate: [210, 105, 30], coral: [255, 127, 80], cornflowerblue: [100, 149, 237], cornsilk: [255, 248, 220], crimson: [220, 20, 60], cyan: [0, 255, 255], darkblue: [0, 0, 139], darkcyan: [0, 139, 139], darkgoldenrod: [184, 134, 11], darkgray: [169, 169, 169], darkgreen: [0, 100, 0], darkgrey: [169, 169, 169], darkkhaki: [189, 183, 107], darkmagenta: [139, 0, 139], darkolivegreen: [85, 107, 47], darkorange: [255, 140, 0], darkorchid: [153, 50, 204], darkred: [139, 0, 0], darksalmon: [233, 150, 122], darkseagreen: [143, 188, 143], darkslateblue: [72, 61, 139], darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79], darkturquoise: [0, 206, 209], darkviolet: [148, 0, 211], deeppink: [255, 20, 147], deepskyblue: [0, 191, 255], dimgray: [105, 105, 105], dimgrey: [105, 105, 105], dodgerblue: [30, 144, 255], firebrick: [178, 34, 34], floralwhite: [255, 250, 240], forestgreen: [34, 139, 34], fuchsia: [255, 0, 255], gainsboro: [220, 220, 220], ghostwhite: [248, 248, 255], gold: [255, 215, 0], goldenrod: [218, 165, 32], gray: [128, 128, 128], green: [0, 128, 0], greenyellow: [173, 255, 47], grey: [128, 128, 128], honeydew: [240, 255, 240], hotpink: [255, 105, 180], indianred: [205, 92, 92], indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140], lavender: [230, 230, 250], lavenderblush: [255, 240, 245], lawngreen: [124, 252, 0], lemonchiffon: [255, 250, 205], lightblue: [173, 216, 230], lightcoral: [240, 128, 128], lightcyan: [224, 255, 255], lightgoldenrodyellow: [250, 250, 210], lightgray: [211, 211, 211], lightgreen: [144, 238, 144], lightgrey: [211, 211, 211], lightpink: [255, 182, 193], lightsalmon: [255, 160, 122], lightseagreen: [32, 178, 170], lightskyblue: [135, 206, 250], lightslategray: [119, 136, 153], lightslategrey: [119, 136, 153], lightsteelblue: [176, 196, 222], lightyellow: [255, 255, 224], lime: [0, 255, 0], limegreen: [50, 205, 50], linen: [250, 240, 230], magenta: [255, 0, 255], maroon: [128, 0, 0], mediumaquamarine: [102, 205, 170], mediumblue: [0, 0, 205], mediumorchid: [186, 85, 211], mediumpurple: [147, 112, 219], mediumseagreen: [60, 179, 113], mediumslateblue: [123, 104, 238], mediumspringgreen: [0, 250, 154], mediumturquoise: [72, 209, 204], mediumvioletred: [199, 21, 133], midnightblue: [25, 25, 112], mintcream: [245, 255, 250], mistyrose: [255, 228, 225], moccasin: [255, 228, 181], navajowhite: [255, 222, 173], navy: [0, 0, 128], oldlace: [253, 245, 230], olive: [128, 128, 0], olivedrab: [107, 142, 35], orange: [255, 165, 0], orangered: [255, 69, 0], orchid: [218, 112, 214], palegoldenrod: [238, 232, 170], palegreen: [152, 251, 152], paleturquoise: [175, 238, 238], palevioletred: [219, 112, 147], papayawhip: [255, 239, 213], peachpuff: [255, 218, 185], peru: [205, 133, 63], pink: [255, 192, 203], plum: [221, 160, 221], powderblue: [176, 224, 230], purple: [128, 0, 128], rebeccapurple: [102, 51, 153], red: [255, 0, 0], rosybrown: [188, 143, 143], royalblue: [65, 105, 225], saddlebrown: [139, 69, 19], salmon: [250, 128, 114], sandybrown: [244, 164, 96], seagreen: [46, 139, 87], seashell: [255, 245, 238], sienna: [160, 82, 45], silver: [192, 192, 192], skyblue: [135, 206, 235], slateblue: [106, 90, 205], slategray: [112, 128, 144], slategrey: [112, 128, 144], snow: [255, 250, 250], springgreen: [0, 255, 127], steelblue: [70, 130, 180], tan: [210, 180, 140], teal: [0, 128, 128], thistle: [216, 191, 216], tomato: [255, 99, 71], turquoise: [64, 224, 208], violet: [238, 130, 238], wheat: [245, 222, 179], white: [255, 255, 255], whitesmoke: [245, 245, 245], yellow: [255, 255, 0], yellowgreen: [154, 205, 50] };
function luminance(_4) {
  const [t3, n3, o3] = _4.map((_5) => _5 <= 0.04045 ? _5 / 12.92 : Math.pow((_5 + 0.055) / 1.055, 2.4));
  return 0.2126 * t3 + 0.7152 * n3 + 0.0722 * o3;
}
function contrast_ratio_wcag_2_1(_4, t3) {
  const n3 = luminance(_4), o3 = luminance(t3);
  return (Math.max(n3, o3) + 0.05) / (Math.min(n3, o3) + 0.05);
}

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@csstools/css-color-parser/dist/index.mjs
var xe;
var De;
function normalize(e3, n3, a3, o3) {
  return Math.min(Math.max(e3 / n3, a3), o3);
}
function convertNaNToZero(e3) {
  return [Number.isNaN(e3[0]) ? 0 : e3[0], Number.isNaN(e3[1]) ? 0 : e3[1], Number.isNaN(e3[2]) ? 0 : e3[2]];
}
function colorData_to_XYZ_D50(e3) {
  switch (e3.colorNotation) {
    case xe.HEX:
    case xe.RGB:
    case xe.sRGB:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: sRGB_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.Linear_sRGB:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: lin_sRGB_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.Display_P3:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: P3_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.Linear_Display_P3:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: lin_P3_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.Rec2020:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: rec_2020_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.A98_RGB:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: a98_RGB_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.ProPhoto_RGB:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: ProPhoto_RGB_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.HSL:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: HSL_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.HWB:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: HWB_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.Lab:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: Lab_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.OKLab:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: OKLab_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.LCH:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: LCH_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.OKLCH:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: OKLCH_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.XYZ_D50:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: XYZ_D50_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    case xe.XYZ_D65:
      return { ...e3, colorNotation: xe.XYZ_D50, channels: XYZ_D65_to_XYZ_D50(convertNaNToZero(e3.channels)) };
    default:
      throw new Error("Unsupported color notation");
  }
}
function colorData_to_XYZ_D65(e3) {
  switch (e3.colorNotation) {
    case xe.HEX:
    case xe.RGB:
    case xe.sRGB:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: sRGB_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.Linear_sRGB:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: lin_sRGB_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.Display_P3:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: P3_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.Linear_Display_P3:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: lin_P3_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.Rec2020:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: rec_2020_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.A98_RGB:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: a98_RGB_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.ProPhoto_RGB:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: ProPhoto_RGB_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.HSL:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: HSL_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.HWB:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: HWB_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.Lab:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: Lab_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.OKLab:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: OKLab_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.LCH:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: LCH_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.OKLCH:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: OKLCH_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.XYZ_D50:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: XYZ_D50_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    case xe.XYZ_D65:
      return { ...e3, colorNotation: xe.XYZ_D65, channels: XYZ_D65_to_XYZ_D65(convertNaNToZero(e3.channels)) };
    default:
      throw new Error("Unsupported color notation");
  }
}
!(function(e3) {
  e3.A98_RGB = "a98-rgb", e3.Display_P3 = "display-p3", e3.Linear_Display_P3 = "display-p3-linear", e3.HEX = "hex", e3.HSL = "hsl", e3.HWB = "hwb", e3.LCH = "lch", e3.Lab = "lab", e3.Linear_sRGB = "srgb-linear", e3.OKLCH = "oklch", e3.OKLab = "oklab", e3.ProPhoto_RGB = "prophoto-rgb", e3.RGB = "rgb", e3.sRGB = "srgb", e3.Rec2020 = "rec2020", e3.XYZ_D50 = "xyz-d50", e3.XYZ_D65 = "xyz-d65";
})(xe || (xe = {})), (function(e3) {
  e3.ColorKeyword = "color-keyword", e3.HasAlpha = "has-alpha", e3.HasDimensionValues = "has-dimension-values", e3.HasNoneKeywords = "has-none-keywords", e3.HasNumberValues = "has-number-values", e3.HasPercentageAlpha = "has-percentage-alpha", e3.HasPercentageValues = "has-percentage-values", e3.HasVariableAlpha = "has-variable-alpha", e3.Hex = "hex", e3.LegacyHSL = "legacy-hsl", e3.LegacyRGB = "legacy-rgb", e3.NamedColor = "named-color", e3.RelativeColorSyntax = "relative-color-syntax", e3.ColorMix = "color-mix", e3.ColorMixVariadic = "color-mix-variadic", e3.ContrastColor = "contrast-color", e3.RelativeAlphaSyntax = "relative-alpha-syntax", e3.Experimental = "experimental";
})(De || (De = {}));
var Le = /* @__PURE__ */ new Set([xe.A98_RGB, xe.Display_P3, xe.Linear_Display_P3, xe.HEX, xe.Linear_sRGB, xe.ProPhoto_RGB, xe.RGB, xe.sRGB, xe.Rec2020, xe.XYZ_D50, xe.XYZ_D65]);
function colorDataToForInterpolation(e3, n3) {
  if (e3.colorNotation === n3) return { ...e3 };
  const a3 = [...e3.channels];
  let o3 = { ...e3 };
  return o3.channels = convertPowerlessComponentsToMissingComponents(o3.channels, e3.colorNotation), o3 = convertToDestination(o3, n3), o3.channels = carryForwardMissingComponentsForColorAndNotation(o3, e3.colorNotation, n3, a3), o3;
}
function colorDataToForRelativeColorSyntax(e3, n3) {
  if (e3.colorNotation === n3) return { ...e3 };
  const a3 = [...e3.channels];
  let o3 = { ...e3 };
  return o3.channels = convertPowerlessComponentsToMissingComponents(o3.channels, e3.colorNotation), o3 = convertToDestination(o3, n3), o3.channels = carryForwardMissingComponentsForColorAndNotation(o3, e3.colorNotation, n3, a3), o3;
}
function convertToDestination(e3, n3) {
  if (e3.colorNotation === n3) return e3.channels = convertNaNToZero(e3.channels), e3.channels = convertPowerlessComponentsToMissingComponents(e3.channels, n3), e3;
  switch (n3) {
    case xe.HEX:
    case xe.RGB: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.RGB, e3.channels = XYZ_D65_to_sRGB(n4.channels), e3.channels = e3.channels.map((e4) => reducePrecisionOrNaN(e4, 8)), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.sRGB: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.sRGB, e3.channels = XYZ_D65_to_sRGB(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.Linear_sRGB: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.Linear_sRGB, e3.channels = XYZ_D65_to_lin_sRGB(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.Display_P3: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.Display_P3, e3.channels = XYZ_D65_to_P3(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.Linear_Display_P3: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.Linear_Display_P3, e3.channels = XYZ_D65_to_lin_P3(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.Rec2020: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.Rec2020, e3.channels = XYZ_D65_to_rec_2020(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.ProPhoto_RGB: {
      const n4 = colorData_to_XYZ_D50(e3);
      e3.colorNotation = xe.ProPhoto_RGB, e3.channels = XYZ_D50_to_ProPhoto(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.A98_RGB: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.A98_RGB, e3.channels = XYZ_D65_to_a98_RGB(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.HSL: {
      const a3 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.HSL, e3.channels = XYZ_D65_to_HSL(a3.channels), e3.channels = e3.channels.map((e4) => reducePrecisionOrNaN(e4, 8)), e3.channels = normalizeAfterColorConversion(e3.channels, 0), e3.channels = convertPowerlessComponentsToMissingComponents(e3.channels, n3);
      break;
    }
    case xe.HWB: {
      const a3 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.HWB, e3.channels = XYZ_D65_to_HWB(a3.channels), e3.channels = e3.channels.map((e4) => reducePrecisionOrNaN(e4, 8)), e3.channels = normalizeAfterColorConversion(e3.channels, 0), e3.channels = convertPowerlessComponentsToMissingComponents(e3.channels, n3);
      break;
    }
    case xe.Lab: {
      const n4 = colorData_to_XYZ_D50(e3);
      e3.colorNotation = xe.Lab, e3.channels = XYZ_D50_to_Lab(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.LCH: {
      const a3 = colorData_to_XYZ_D50(e3);
      e3.colorNotation = xe.LCH, e3.channels = XYZ_D50_to_LCH(a3.channels), e3.channels = normalizeAfterColorConversion(e3.channels, 2), e3.channels = convertPowerlessComponentsToMissingComponents(e3.channels, n3);
      break;
    }
    case xe.OKLCH: {
      const a3 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.OKLCH, e3.channels = XYZ_D65_to_OKLCH(a3.channels), e3.channels = normalizeAfterColorConversion(e3.channels, 2), e3.channels = convertPowerlessComponentsToMissingComponents(e3.channels, n3);
      break;
    }
    case xe.OKLab: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.OKLab, e3.channels = XYZ_D65_to_OKLab(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.XYZ_D50: {
      const n4 = colorData_to_XYZ_D50(e3);
      e3.colorNotation = xe.XYZ_D50, e3.channels = XYZ_D50_to_XYZ_D50(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    case xe.XYZ_D65: {
      const n4 = colorData_to_XYZ_D65(e3);
      e3.colorNotation = xe.XYZ_D65, e3.channels = XYZ_D65_to_XYZ_D65(n4.channels), e3.channels = normalizeAfterColorConversion(e3.channels);
      break;
    }
    default:
      throw new Error("Unsupported color notation");
  }
  return e3;
}
function carryForwardMissingComponentsForColorAndNotation(e3, n3, a3, o3) {
  if (n3 === a3) return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [0, 1, 2], []);
  if (Le.has(a3) && Le.has(n3)) return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [0, 1, 2], []);
  switch (a3) {
    case xe.HSL:
      switch (n3) {
        case xe.HWB:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [0], [1, 2]);
        case xe.Lab:
        case xe.OKLab:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [2], [0, 1]);
        case xe.LCH:
        case xe.OKLCH:
          return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [2, 1, 0], []);
        default:
          return carryForwardMissingComponents(o3, [], [], e3.channels, [], []);
      }
    case xe.HWB:
      switch (n3) {
        case xe.HSL:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [0], [1, 2]);
        case xe.LCH:
        case xe.OKLCH:
          return carryForwardMissingComponents(o3, [2], [0, 1], e3.channels, [0], [1, 2]);
        default:
          return carryForwardMissingComponents(o3, [], [], e3.channels, [], []);
      }
    case xe.Lab:
    case xe.OKLab:
      switch (n3) {
        case xe.HSL:
          return carryForwardMissingComponents(o3, [2], [0, 1], e3.channels, [0], [1, 2]);
        case xe.Lab:
        case xe.OKLab:
          return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [0, 1, 2], []);
        case xe.LCH:
        case xe.OKLCH:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [0], [1, 2]);
        default:
          return carryForwardMissingComponents(o3, [], [], e3.channels, [], []);
      }
    case xe.LCH:
    case xe.OKLCH:
      switch (n3) {
        case xe.HSL:
          return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [2, 1, 0], []);
        case xe.HWB:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [2], [0, 1]);
        case xe.Lab:
        case xe.OKLab:
          return carryForwardMissingComponents(o3, [0], [1, 2], e3.channels, [0], [1, 2]);
        case xe.LCH:
        case xe.OKLCH:
          return carryForwardMissingComponents(o3, [0, 1, 2], [], e3.channels, [0, 1, 2], []);
        default:
          return carryForwardMissingComponents(o3, [], [], e3.channels, [], []);
      }
    default:
      return carryForwardMissingComponents(o3, [], [], e3.channels, [], []);
  }
}
function convertPowerlessComponentsToMissingComponents(e3, n3) {
  const a3 = [...e3];
  switch (n3) {
    case xe.HSL:
      (Number.isNaN(a3[1]) ? 0 : a3[1]) <= 1e-3 && (a3[0] = Number.NaN, !Number.isNaN(a3[1]) && a3[1] > 0 && (a3[1] = 0));
      break;
    case xe.HWB:
      Math.max(0, Number.isNaN(a3[1]) ? 0 : a3[1]) + Math.max(0, Number.isNaN(a3[2]) ? 0 : a3[2]) >= 99.999 && (a3[0] = Number.NaN, Math.max(0, Number.isNaN(a3[1]) ? 0 : a3[1]) + Math.max(0, Number.isNaN(a3[2]) ? 0 : a3[2]) < 100 && (Number.isNaN(a3[1]) ? a3[2] = 100 : Number.isNaN(a3[2]) ? a3[1] = 100 : a3[2] = 100 - a3[1]));
      break;
    case xe.LCH:
      (Number.isNaN(a3[1]) ? 0 : a3[1]) <= 15e-4 && (a3[2] = Number.NaN, !Number.isNaN(a3[1]) && a3[1] > 0 && (a3[1] = 0));
      break;
    case xe.OKLCH:
      (Number.isNaN(a3[1]) ? 0 : a3[1]) <= 4e-6 && (a3[2] = Number.NaN, !Number.isNaN(a3[1]) && a3[1] > 0 && (a3[1] = 0));
  }
  return a3;
}
function carryForwardMissingComponents(e3, n3, a3, o3, r3, t3) {
  if (n3.length < 3 && e3.every(Number.isNaN)) return [Number.NaN, Number.NaN, Number.NaN];
  const l3 = [...o3];
  for (let a4 = 0; a4 < n3.length; a4++) Number.isNaN(e3[n3[a4]]) && (l3[r3[a4]] = Number.NaN);
  if (a3.length && a3.every((n4) => Number.isNaN(e3[n4]))) for (let e4 = 0; e4 < t3.length; e4++) l3[t3[e4]] = Number.NaN;
  return l3;
}
function normalizeRelativeColorDataChannels(e3) {
  const n3 = /* @__PURE__ */ new Map();
  switch (e3.colorNotation) {
    case xe.RGB:
    case xe.HEX:
      n3.set("r", dummyNumberToken(255 * e3.channels[0])), n3.set("g", dummyNumberToken(255 * e3.channels[1])), n3.set("b", dummyNumberToken(255 * e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.HSL:
      n3.set("h", dummyNumberToken(e3.channels[0])), n3.set("s", dummyNumberToken(e3.channels[1])), n3.set("l", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.HWB:
      n3.set("h", dummyNumberToken(e3.channels[0])), n3.set("w", dummyNumberToken(e3.channels[1])), n3.set("b", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.Lab:
    case xe.OKLab:
      n3.set("l", dummyNumberToken(e3.channels[0])), n3.set("a", dummyNumberToken(e3.channels[1])), n3.set("b", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.LCH:
    case xe.OKLCH:
      n3.set("l", dummyNumberToken(e3.channels[0])), n3.set("c", dummyNumberToken(e3.channels[1])), n3.set("h", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.sRGB:
    case xe.A98_RGB:
    case xe.Display_P3:
    case xe.Linear_Display_P3:
    case xe.Rec2020:
    case xe.Linear_sRGB:
    case xe.ProPhoto_RGB:
      n3.set("r", dummyNumberToken(e3.channels[0])), n3.set("g", dummyNumberToken(e3.channels[1])), n3.set("b", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
      break;
    case xe.XYZ_D50:
    case xe.XYZ_D65:
      n3.set("x", dummyNumberToken(e3.channels[0])), n3.set("y", dummyNumberToken(e3.channels[1])), n3.set("z", dummyNumberToken(e3.channels[2])), "number" == typeof e3.alpha && n3.set("alpha", dummyNumberToken(e3.alpha));
  }
  return n3;
}
function noneToZeroInRelativeColorDataChannels(e3) {
  const n3 = new Map(e3);
  for (const [a3, o3] of e3) Number.isNaN(o3[4].value) && n3.set(a3, dummyNumberToken(0));
  return n3;
}
function normalizeAfterColorConversion(e3, n3 = -1) {
  return e3 = convertNaNToZero(e3), e3 = [0 === n3 ? e3[0] : normalize(e3[0], 1, -2147483647, 2147483647), 1 === n3 ? e3[1] : normalize(e3[1], 1, -2147483647, 2147483647), 2 === n3 ? e3[2] : normalize(e3[2], 1, -2147483647, 2147483647)], Number.isNaN(e3[n3]) || Number.isFinite(e3[n3]) || (e3[n3] = 0), e3;
}
function dummyNumberToken(a3) {
  return Number.isNaN(a3) ? [u.Number, "none", -1, -1, { value: Number.NaN, type: a.Number }] : [u.Number, a3.toString(), -1, -1, { value: a3, type: a.Number }];
}
function reducePrecisionOrNaN(e3, n3 = 7) {
  if (Number.isNaN(e3)) return e3;
  const a3 = Math.pow(10, n3);
  return Math.round(e3 * a3) / a3;
}
var He = /[A-Z]/g;
function toLowerCaseAZ2(e3) {
  return e3.replace(He, (e4) => String.fromCharCode(e4.charCodeAt(0) + 32));
}
function normalize_Color_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 100, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 3 === l3 ? normalize(t3[4].value, 1, 0, 1) : normalize(t3[4].value, 1, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
var Pe = /* @__PURE__ */ new Set(["srgb", "srgb-linear", "display-p3", "display-p3-linear", "a98-rgb", "prophoto-rgb", "rec2020", "xyz", "xyz-d50", "xyz-d65"]);
function color$1(e3, n3) {
  const o3 = [], s4 = [], c4 = [], i3 = [];
  let u4, h3, N2 = false, m3 = false;
  const p2 = { colorNotation: xe.sRGB, channels: [0, 0, 0], alpha: 1, syntaxFlags: /* @__PURE__ */ new Set([]) };
  let b3 = o3;
  for (let r3 = 0; r3 < e3.value.length; r3++) {
    let v3 = e3.value[r3];
    if (isWhitespaceNode(v3) || isCommentNode(v3)) for (; isWhitespaceNode(e3.value[r3 + 1]) || isCommentNode(e3.value[r3 + 1]); ) r3++;
    else if (b3 === o3 && o3.length && (b3 = s4), b3 === s4 && s4.length && (b3 = c4), isTokenNode(v3) && isTokenDelim(v3.value) && "/" === v3.value[4].value) {
      if (b3 === i3) return false;
      b3 = i3;
    } else {
      if (isFunctionNode(v3)) {
        if (b3 === i3 && "var" === toLowerCaseAZ2(v3.getName())) {
          p2.syntaxFlags.add(De.HasVariableAlpha), b3.push(v3);
          continue;
        }
        if (!Q.has(toLowerCaseAZ2(v3.getName()))) return false;
        const [[e4]] = calcFromComponentValues([[v3]], { censorIntoStandardRepresentableValues: true, globals: h3, precision: -1, toCanonicalUnits: true, rawPercentages: true });
        if (!e4 || !isTokenNode(e4) || !isTokenNumeric(e4.value)) return false;
        Number.isNaN(e4.value[4].value) && (e4.value[4].value = 0), v3 = e4;
      }
      if (b3 === o3 && 0 === o3.length && isTokenNode(v3) && isTokenIdent(v3.value) && Pe.has(toLowerCaseAZ2(v3.value[4].value))) {
        if (N2) return false;
        N2 = toLowerCaseAZ2(v3.value[4].value), p2.colorNotation = colorSpaceNameToColorNotation(N2), m3 && (m3 = colorDataToForRelativeColorSyntax(m3, p2.colorNotation), u4 = normalizeRelativeColorDataChannels(m3), h3 = noneToZeroInRelativeColorDataChannels(u4));
      } else if (b3 === o3 && 0 === o3.length && isTokenNode(v3) && isTokenIdent(v3.value) && "from" === toLowerCaseAZ2(v3.value[4].value)) {
        if (m3) return false;
        if (N2) return false;
        for (; isWhitespaceNode(e3.value[r3 + 1]) || isCommentNode(e3.value[r3 + 1]); ) r3++;
        if (r3++, v3 = e3.value[r3], m3 = n3(v3), false === m3) return false;
        m3.syntaxFlags.has(De.Experimental) && p2.syntaxFlags.add(De.Experimental), p2.syntaxFlags.add(De.RelativeColorSyntax);
      } else {
        if (!isTokenNode(v3)) return false;
        if (isTokenIdent(v3.value) && u4 && u4.has(toLowerCaseAZ2(v3.value[4].value))) {
          b3.push(new TokenNode(u4.get(toLowerCaseAZ2(v3.value[4].value))));
          continue;
        }
        b3.push(v3);
      }
    }
  }
  if (!N2) return false;
  if (1 !== b3.length) return false;
  if (1 !== o3.length || 1 !== s4.length || 1 !== c4.length) return false;
  if (!isTokenNode(o3[0]) || !isTokenNode(s4[0]) || !isTokenNode(c4[0])) return false;
  if (u4 && !u4.has("alpha")) return false;
  const v2 = normalize_Color_ChannelValues(o3[0].value, 0, p2);
  if (!v2 || !isTokenNumber(v2)) return false;
  const f4 = normalize_Color_ChannelValues(s4[0].value, 1, p2);
  if (!f4 || !isTokenNumber(f4)) return false;
  const g3 = normalize_Color_ChannelValues(c4[0].value, 2, p2);
  if (!g3 || !isTokenNumber(g3)) return false;
  const d5 = [v2, f4, g3];
  if (1 === i3.length) if (p2.syntaxFlags.add(De.HasAlpha), isTokenNode(i3[0])) {
    const e4 = normalize_Color_ChannelValues(i3[0].value, 3, p2);
    if (!e4 || !isTokenNumber(e4)) return false;
    d5.push(e4);
  } else p2.alpha = i3[0];
  else if (u4 && u4.has("alpha")) {
    const e4 = normalize_Color_ChannelValues(u4.get("alpha"), 3, p2);
    if (!e4 || !isTokenNumber(e4)) return false;
    d5.push(e4);
  }
  return p2.channels = [d5[0][4].value, d5[1][4].value, d5[2][4].value], 4 === d5.length && (p2.alpha = d5[3][4].value), p2;
}
function colorSpaceNameToColorNotation(e3) {
  switch (e3) {
    case "srgb":
      return xe.sRGB;
    case "srgb-linear":
      return xe.Linear_sRGB;
    case "display-p3":
      return xe.Display_P3;
    case "display-p3-linear":
      return xe.Linear_Display_P3;
    case "a98-rgb":
      return xe.A98_RGB;
    case "prophoto-rgb":
      return xe.ProPhoto_RGB;
    case "rec2020":
      return xe.Rec2020;
    case "xyz":
    case "xyz-d65":
      return xe.XYZ_D65;
    case "xyz-d50":
      return xe.XYZ_D50;
    default:
      throw new Error("Unknown color space name: " + e3);
  }
}
var Ze = /* @__PURE__ */ new Set(["srgb", "srgb-linear", "display-p3", "display-p3-linear", "a98-rgb", "prophoto-rgb", "rec2020", "lab", "oklab", "xyz", "xyz-d50", "xyz-d65"]);
var Me = /* @__PURE__ */ new Set(["hsl", "hwb", "lch", "oklch"]);
var $e = /* @__PURE__ */ new Set(["shorter", "longer", "increasing", "decreasing"]);
function colorMix(e3, n3) {
  let o3 = null, r3 = null, t3 = null, l3 = false;
  for (let c4 = 0; c4 < e3.value.length; c4++) {
    const i3 = e3.value[c4];
    if (!isWhiteSpaceOrCommentNode(i3)) {
      if (!(o3 || isTokenNode(i3) && isTokenIdent(i3.value) && "in" === toLowerCaseAZ2(i3.value[4].value))) return colorMixRectangular("oklab", colorMixComponents(e3.value, n3));
      if (isTokenNode(i3) && isTokenIdent(i3.value)) {
        if (!o3 && "in" === toLowerCaseAZ2(i3.value[4].value)) {
          o3 = i3;
          continue;
        }
        if (o3 && !r3) {
          r3 = toLowerCaseAZ2(i3.value[4].value);
          continue;
        }
        if (o3 && r3 && !t3 && Me.has(r3)) {
          t3 = toLowerCaseAZ2(i3.value[4].value);
          continue;
        }
        if (o3 && r3 && t3 && !l3 && "hue" === toLowerCaseAZ2(i3.value[4].value)) {
          l3 = true;
          continue;
        }
        return false;
      }
      return !(!isTokenNode(i3) || !isTokenComma(i3.value)) && (!!r3 && (t3 || l3 ? !!(t3 && l3 && Me.has(r3) && $e.has(t3)) && colorMixPolar(r3, t3, colorMixComponents(e3.value.slice(c4 + 1), n3)) : Ze.has(r3) ? colorMixRectangular(r3, colorMixComponents(e3.value.slice(c4 + 1), n3)) : !!Me.has(r3) && colorMixPolar(r3, "shorter", colorMixComponents(e3.value.slice(c4 + 1), n3))));
    }
  }
  return false;
}
function colorMixComponents(e3, n3) {
  const a3 = [];
  let r3 = false, t3 = false;
  for (let c4 = 0; c4 < e3.length; c4++) {
    let i3 = e3[c4];
    if (!isWhiteSpaceOrCommentNode(i3)) {
      if (!isTokenNode(i3) || !isTokenComma(i3.value)) {
        if (!r3) {
          const e4 = n3(i3);
          if (e4) {
            r3 = e4;
            continue;
          }
        }
        if (!t3) {
          if (isFunctionNode(i3) && Q.has(toLowerCaseAZ2(i3.getName()))) {
            if ([[i3]] = calcFromComponentValues([[i3]], { censorIntoStandardRepresentableValues: true, precision: -1, toCanonicalUnits: true, rawPercentages: true }), !i3 || !isTokenNode(i3) || !isTokenNumeric(i3.value)) return false;
            Number.isNaN(i3.value[4].value) && (i3.value[4].value = 0);
          }
          if (isTokenNode(i3) && isTokenPercentage(i3.value) && i3.value[4].value >= 0) {
            t3 = i3.value[4].value;
            continue;
          }
        }
        return false;
      }
      if (!r3) return false;
      a3.push({ color: r3, percentage: t3 }), r3 = false, t3 = false;
    }
  }
  return !!r3 && (a3.push({ color: r3, percentage: t3 }), a3);
}
function colorMixRectangular(e3, n3) {
  if (!n3 || !n3.length) return false;
  for (const e4 of n3) if (e4.percentage && (e4.percentage < 0 || e4.percentage > 100)) return false;
  const { items: a3, leftover: o3 } = normalizeMixPercentages2(n3, true), r3 = 1 - o3 / 100;
  let t3;
  switch (e3) {
    case "srgb":
      t3 = xe.RGB;
      break;
    case "srgb-linear":
      t3 = xe.Linear_sRGB;
      break;
    case "display-p3":
      t3 = xe.Display_P3;
      break;
    case "display-p3-linear":
      t3 = xe.Linear_Display_P3;
      break;
    case "a98-rgb":
      t3 = xe.A98_RGB;
      break;
    case "prophoto-rgb":
      t3 = xe.ProPhoto_RGB;
      break;
    case "rec2020":
      t3 = xe.Rec2020;
      break;
    case "lab":
      t3 = xe.Lab;
      break;
    case "oklab":
      t3 = xe.OKLab;
      break;
    case "xyz-d50":
      t3 = xe.XYZ_D50;
      break;
    case "xyz":
    case "xyz-d65":
      t3 = xe.XYZ_D65;
      break;
    default:
      return false;
  }
  if (1 === a3.length) {
    const e4 = colorDataToForInterpolation(a3[0].color, t3);
    return e4.colorNotation = t3, e4.syntaxFlags.add(De.ColorMixVariadic), e4.syntaxFlags.add(De.ColorMix), "number" != typeof e4.alpha ? false : (e4.alpha = e4.alpha * r3, e4);
  }
  for (a3.reverse(); a3.length >= 2; ) {
    const e4 = a3.pop(), n4 = a3.pop();
    if (!e4 || !n4) return false;
    const o4 = e4.percentage + n4.percentage, r4 = o4 > 0 ? n4.percentage / o4 : 0.5, l4 = colorMixRectangularPair(t3, e4.color, n4.color, r4);
    if (!l4) return false;
    a3.push({ color: l4, percentage: o4 });
  }
  const l3 = a3[0]?.color;
  return !!l3 && ("number" == typeof l3.alpha && (l3.alpha = l3.alpha * r3, n3.some((e4) => e4.color.syntaxFlags.has(De.Experimental)) && l3.syntaxFlags.add(De.Experimental), 2 !== n3.length && l3.syntaxFlags.add(De.ColorMixVariadic), l3));
}
function colorMixRectangularPair(e3, n3, a3, o3) {
  let r3 = n3.alpha;
  if ("number" != typeof r3) return false;
  let t3 = a3.alpha;
  if ("number" != typeof t3) return false;
  r3 = Number.isNaN(r3) ? t3 : r3, t3 = Number.isNaN(t3) ? r3 : t3;
  const l3 = colorDataToForInterpolation(n3, e3).channels, s4 = colorDataToForInterpolation(a3, e3).channels;
  l3[0] = fillInMissingComponent(l3[0], s4[0]), s4[0] = fillInMissingComponent(s4[0], l3[0]), l3[1] = fillInMissingComponent(l3[1], s4[1]), s4[1] = fillInMissingComponent(s4[1], l3[1]), l3[2] = fillInMissingComponent(l3[2], s4[2]), s4[2] = fillInMissingComponent(s4[2], l3[2]), l3[0] = premultiply(l3[0], r3), l3[1] = premultiply(l3[1], r3), l3[2] = premultiply(l3[2], r3), s4[0] = premultiply(s4[0], t3), s4[1] = premultiply(s4[1], t3), s4[2] = premultiply(s4[2], t3);
  const c4 = interpolate(r3, t3, o3);
  return { colorNotation: e3, channels: [un_premultiply(interpolate(l3[0], s4[0], o3), c4), un_premultiply(interpolate(l3[1], s4[1], o3), c4), un_premultiply(interpolate(l3[2], s4[2], o3), c4)], alpha: c4, syntaxFlags: /* @__PURE__ */ new Set([De.ColorMix]) };
}
function colorMixPolar(e3, n3, a3) {
  if (!a3 || !a3.length) return false;
  for (const e4 of a3) if (e4.percentage && (e4.percentage < 0 || e4.percentage > 100)) return false;
  const { items: o3, leftover: r3 } = normalizeMixPercentages2(a3, true), t3 = 1 - r3 / 100;
  let l3;
  switch (e3) {
    case "hsl":
      l3 = xe.HSL;
      break;
    case "hwb":
      l3 = xe.HWB;
      break;
    case "lch":
      l3 = xe.LCH;
      break;
    case "oklch":
      l3 = xe.OKLCH;
      break;
    default:
      return false;
  }
  if (1 === o3.length) {
    const e4 = colorDataToForInterpolation(o3[0].color, l3);
    return e4.colorNotation = l3, e4.syntaxFlags.add(De.ColorMixVariadic), e4.syntaxFlags.add(De.ColorMix), "number" != typeof e4.alpha ? false : (e4.alpha = e4.alpha * t3, e4);
  }
  for (o3.reverse(); o3.length >= 2; ) {
    const e4 = o3.pop(), a4 = o3.pop();
    if (!e4 || !a4) return false;
    const r4 = e4.percentage + a4.percentage, t4 = r4 > 0 ? a4.percentage / r4 : 0.5, s5 = colorMixPolarPair(l3, n3, e4.color, a4.color, t4);
    if (!s5) return false;
    o3.push({ color: s5, percentage: r4 });
  }
  const s4 = o3[0]?.color;
  return !!s4 && ("number" == typeof s4.alpha && (s4.alpha = s4.alpha * t3, a3.some((e4) => e4.color.syntaxFlags.has(De.Experimental)) && s4.syntaxFlags.add(De.Experimental), 2 !== a3.length && s4.syntaxFlags.add(De.ColorMixVariadic), s4));
}
function colorMixPolarPair(e3, n3, a3, o3, r3) {
  let t3 = 0, l3 = 0, s4 = 0, c4 = 0, i3 = 0, u4 = 0, h3 = a3.alpha;
  if ("number" != typeof h3) return false;
  let N2 = o3.alpha;
  if ("number" != typeof N2) return false;
  h3 = Number.isNaN(h3) ? N2 : h3, N2 = Number.isNaN(N2) ? h3 : N2;
  const m3 = colorDataToForInterpolation(a3, e3).channels, p2 = colorDataToForInterpolation(o3, e3).channels;
  switch (e3) {
    case xe.HSL:
    case xe.HWB:
      t3 = m3[0], l3 = p2[0], s4 = m3[1], c4 = p2[1], i3 = m3[2], u4 = p2[2];
      break;
    case xe.LCH:
    case xe.OKLCH:
      s4 = m3[0], c4 = p2[0], i3 = m3[1], u4 = p2[1], t3 = m3[2], l3 = p2[2];
  }
  if (s4 = fillInMissingComponent(s4, c4), c4 = fillInMissingComponent(c4, s4), i3 = fillInMissingComponent(i3, u4), u4 = fillInMissingComponent(u4, i3), t3 = fillInMissingComponent(t3, l3), l3 = fillInMissingComponent(l3, t3), Number.isNaN(t3) && Number.isNaN(l3)) ;
  else {
    const e4 = l3 - t3;
    switch (n3) {
      case "shorter":
        e4 > 180 ? t3 += 360 : e4 < -180 && (l3 += 360);
        break;
      case "longer":
        -180 < e4 && e4 < 180 && (e4 > 0 ? t3 += 360 : l3 += 360);
        break;
      case "increasing":
        e4 < 0 && (l3 += 360);
        break;
      case "decreasing":
        e4 > 0 && (t3 += 360);
        break;
      default:
        throw new Error("Unknown hue interpolation method");
    }
  }
  s4 = premultiply(s4, h3), i3 = premultiply(i3, h3), c4 = premultiply(c4, N2), u4 = premultiply(u4, N2);
  let b3 = [0, 0, 0];
  const v2 = interpolate(h3, N2, r3);
  switch (e3) {
    case xe.HSL:
    case xe.HWB:
      b3 = [interpolate(t3, l3, r3), un_premultiply(interpolate(s4, c4, r3), v2), un_premultiply(interpolate(i3, u4, r3), v2)];
      break;
    case xe.LCH:
    case xe.OKLCH:
      b3 = [un_premultiply(interpolate(s4, c4, r3), v2), un_premultiply(interpolate(i3, u4, r3), v2), interpolate(t3, l3, r3)];
  }
  return { colorNotation: e3, channels: b3, alpha: v2, syntaxFlags: /* @__PURE__ */ new Set([De.ColorMix]) };
}
function fillInMissingComponent(e3, n3) {
  return Number.isNaN(e3) ? n3 : e3;
}
function interpolate(e3, n3, a3) {
  return e3 * (1 - a3) + n3 * a3;
}
function premultiply(e3, n3) {
  return Number.isNaN(n3) ? e3 : Number.isNaN(e3) ? Number.NaN : e3 * n3;
}
function un_premultiply(e3, n3) {
  return 0 === n3 || Number.isNaN(n3) ? e3 : Number.isNaN(e3) ? Number.NaN : e3 / n3;
}
function normalizeMixPercentages2(e3, n3 = false) {
  let a3 = 0, o3 = 0;
  for (const n4 of e3) n4.percentage && (a3 += n4.percentage), false === n4.percentage && o3++;
  a3 = Math.min(100, a3);
  for (const n4 of e3) false === n4.percentage && (n4.percentage = (100 - a3) / o3);
  const r3 = e3.slice();
  let t3 = 0;
  for (const e4 of r3) t3 += e4.percentage;
  if (t3 > 100 || t3 > 0 && n3) for (const e4 of r3) e4.percentage = e4.percentage * (100 / t3);
  let l3 = 0;
  return t3 < 100 && (l3 = 100 - t3), { items: r3, leftover: l3 };
}
function hex(e3) {
  const n3 = toLowerCaseAZ2(e3[4].value);
  if (n3.match(/[^a-f0-9]/)) return false;
  const a3 = { colorNotation: xe.HEX, channels: [0, 0, 0], alpha: 1, syntaxFlags: /* @__PURE__ */ new Set([De.Hex]) }, o3 = n3.length;
  if (3 === o3) {
    const e4 = n3[0], o4 = n3[1], r3 = n3[2];
    return a3.channels = [parseInt(e4 + e4, 16) / 255, parseInt(o4 + o4, 16) / 255, parseInt(r3 + r3, 16) / 255], a3;
  }
  if (6 === o3) {
    const e4 = n3[0] + n3[1], o4 = n3[2] + n3[3], r3 = n3[4] + n3[5];
    return a3.channels = [parseInt(e4, 16) / 255, parseInt(o4, 16) / 255, parseInt(r3, 16) / 255], a3;
  }
  if (4 === o3) {
    const e4 = n3[0], o4 = n3[1], r3 = n3[2], t3 = n3[3];
    return a3.channels = [parseInt(e4 + e4, 16) / 255, parseInt(o4 + o4, 16) / 255, parseInt(r3 + r3, 16) / 255], a3.alpha = parseInt(t3 + t3, 16) / 255, a3.syntaxFlags.add(De.HasAlpha), a3;
  }
  if (8 === o3) {
    const e4 = n3[0] + n3[1], o4 = n3[2] + n3[3], r3 = n3[4] + n3[5], t3 = n3[6] + n3[7];
    return a3.channels = [parseInt(e4, 16) / 255, parseInt(o4, 16) / 255, parseInt(r3, 16) / 255], a3.alpha = parseInt(t3, 16) / 255, a3.syntaxFlags.add(De.HasAlpha), a3;
  }
  return false;
}
function normalizeHue$1(a3) {
  if (isTokenNumber(a3)) return Number.isNaN(a3[4].value) || Number.isFinite(a3[4].value) || (a3[4].value = 0), a3[4].value = a3[4].value % 360, a3[4].value < 0 && (a3[4].value += 360), a3[1] = a3[4].value.toString(), a3;
  if (isTokenDimension(a3)) {
    let o3 = a3[4].value;
    switch (toLowerCaseAZ2(a3[4].unit)) {
      case "deg":
        break;
      case "rad":
        o3 = 180 * a3[4].value / Math.PI;
        break;
      case "grad":
        o3 = 0.9 * a3[4].value;
        break;
      case "turn":
        o3 = 360 * a3[4].value;
        break;
      default:
        return false;
    }
    return Number.isNaN(a3[4].value) || Number.isFinite(a3[4].value) || (a3[4].value = 0), o3 %= 360, o3 < 0 && (o3 += 360), [u.Number, o3.toString(), a3[2], a3[3], { value: o3, type: a.Number }];
  }
  return false;
}
function normalize_legacy_HSL_ChannelValues(a3, t3, l3) {
  if (0 === t3) {
    const e3 = normalizeHue$1(a3);
    return false !== e3 && (isTokenDimension(a3) && l3.syntaxFlags.add(De.HasDimensionValues), e3);
  }
  if (isTokenPercentage(a3)) {
    let o3;
    return 3 === t3 ? l3.syntaxFlags.add(De.HasPercentageAlpha) : l3.syntaxFlags.add(De.HasPercentageValues), o3 = 3 === t3 ? normalize(a3[4].value, 100, 0, 1) : normalize(a3[4].value, 1, 0, 100), [u.Number, o3.toString(), a3[2], a3[3], { value: o3, type: a.Number }];
  }
  if (isTokenNumber(a3)) {
    if (3 !== t3) return false;
    let o3;
    return o3 = normalize(a3[4].value, 1, 0, 3 === t3 ? 1 : 100), [u.Number, o3.toString(), a3[2], a3[3], { value: o3, type: a.Number }];
  }
  return false;
}
function normalize_modern_HSL_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (0 === l3) {
    const e3 = normalizeHue$1(t3);
    return false !== e3 && (isTokenDimension(t3) && s4.syntaxFlags.add(De.HasDimensionValues), e3);
  }
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 === l3 ? s4.syntaxFlags.add(De.HasPercentageAlpha) : s4.syntaxFlags.add(De.HasPercentageValues), a3 = 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 1, 1 === l3 ? 0 : -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 3 === l3 ? normalize(t3[4].value, 1, 0, 1) : normalize(t3[4].value, 1, 1 === l3 ? 0 : -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function threeChannelLegacySyntax(e3, n3, a3, o3) {
  const t3 = [], c4 = [], i3 = [], u4 = [], h3 = { colorNotation: a3, channels: [0, 0, 0], alpha: 1, syntaxFlags: new Set(o3) };
  let N2 = t3;
  for (let n4 = 0; n4 < e3.value.length; n4++) {
    let a4 = e3.value[n4];
    if (!isWhitespaceNode(a4) && !isCommentNode(a4)) {
      if (isTokenNode(a4) && isTokenComma(a4.value)) {
        if (N2 === t3) {
          N2 = c4;
          continue;
        }
        if (N2 === c4) {
          N2 = i3;
          continue;
        }
        if (N2 === i3) {
          N2 = u4;
          continue;
        }
        if (N2 === u4) return false;
      }
      if (isFunctionNode(a4)) {
        if (N2 === u4 && "var" === a4.getName().toLowerCase()) {
          h3.syntaxFlags.add(De.HasVariableAlpha), N2.push(a4);
          continue;
        }
        if (!Q.has(a4.getName().toLowerCase())) return false;
        const [[e4]] = calcFromComponentValues([[a4]], { censorIntoStandardRepresentableValues: true, precision: -1, toCanonicalUnits: true, rawPercentages: true });
        if (!e4 || !isTokenNode(e4) || !isTokenNumeric(e4.value)) return false;
        Number.isNaN(e4.value[4].value) && (e4.value[4].value = 0), a4 = e4;
      }
      if (!isTokenNode(a4)) return false;
      N2.push(a4);
    }
  }
  if (1 !== N2.length) return false;
  if (1 !== t3.length || 1 !== c4.length || 1 !== i3.length) return false;
  if (!isTokenNode(t3[0]) || !isTokenNode(c4[0]) || !isTokenNode(i3[0])) return false;
  const m3 = n3(t3[0].value, 0, h3);
  if (!m3 || !isTokenNumber(m3)) return false;
  const p2 = n3(c4[0].value, 1, h3);
  if (!p2 || !isTokenNumber(p2)) return false;
  const b3 = n3(i3[0].value, 2, h3);
  if (!b3 || !isTokenNumber(b3)) return false;
  const v2 = [m3, p2, b3];
  if (1 === u4.length) if (h3.syntaxFlags.add(De.HasAlpha), isTokenNode(u4[0])) {
    const e4 = n3(u4[0].value, 3, h3);
    if (!e4 || !isTokenNumber(e4)) return false;
    v2.push(e4);
  } else h3.alpha = u4[0];
  return h3.channels = [v2[0][4].value, v2[1][4].value, v2[2][4].value], 4 === v2.length && (h3.alpha = v2[3][4].value), h3;
}
function threeChannelSpaceSeparated(e3, n3, o3, s4, c4) {
  const i3 = [], u4 = [], h3 = [], N2 = [];
  let m3, p2, b3 = false;
  const v2 = { colorNotation: o3, channels: [0, 0, 0], alpha: 1, syntaxFlags: new Set(s4) };
  let f4 = i3;
  for (let n4 = 0; n4 < e3.value.length; n4++) {
    let r3 = e3.value[n4];
    if (isWhitespaceNode(r3) || isCommentNode(r3)) for (; isWhitespaceNode(e3.value[n4 + 1]) || isCommentNode(e3.value[n4 + 1]); ) n4++;
    else if (f4 === i3 && i3.length && (f4 = u4), f4 === u4 && u4.length && (f4 = h3), isTokenNode(r3) && isTokenDelim(r3.value) && "/" === r3.value[4].value) {
      if (f4 === N2) return false;
      f4 = N2;
    } else {
      if (isFunctionNode(r3)) {
        if (f4 === N2 && "var" === r3.getName().toLowerCase()) {
          v2.syntaxFlags.add(De.HasVariableAlpha), f4.push(r3);
          continue;
        }
        if (!Q.has(r3.getName().toLowerCase())) return false;
        const [[e4]] = calcFromComponentValues([[r3]], { censorIntoStandardRepresentableValues: true, globals: p2, precision: -1, toCanonicalUnits: true, rawPercentages: true });
        if (!e4 || !isTokenNode(e4) || !isTokenNumeric(e4.value)) return false;
        Number.isNaN(e4.value[4].value) && (e4.value[4].value = 0), r3 = e4;
      }
      if (f4 === i3 && 0 === i3.length && isTokenNode(r3) && isTokenIdent(r3.value) && "from" === r3.value[4].value.toLowerCase()) {
        if (b3) return false;
        for (; isWhitespaceNode(e3.value[n4 + 1]) || isCommentNode(e3.value[n4 + 1]); ) n4++;
        if (n4++, r3 = e3.value[n4], b3 = c4(r3), false === b3) return false;
        b3.syntaxFlags.has(De.Experimental) && v2.syntaxFlags.add(De.Experimental), v2.syntaxFlags.add(De.RelativeColorSyntax), b3 = colorDataToForRelativeColorSyntax(b3, o3), m3 = normalizeRelativeColorDataChannels(b3), p2 = noneToZeroInRelativeColorDataChannels(m3);
      } else {
        if (!isTokenNode(r3)) return false;
        if (isTokenIdent(r3.value) && m3) {
          const e4 = r3.value[4].value.toLowerCase();
          if (m3.has(e4)) {
            f4.push(new TokenNode(m3.get(e4)));
            continue;
          }
        }
        f4.push(r3);
      }
    }
  }
  if (1 !== f4.length) return false;
  if (1 !== i3.length || 1 !== u4.length || 1 !== h3.length) return false;
  if (!isTokenNode(i3[0]) || !isTokenNode(u4[0]) || !isTokenNode(h3[0])) return false;
  if (m3 && !m3.has("alpha")) return false;
  const g3 = n3(i3[0].value, 0, v2);
  if (!g3 || !isTokenNumber(g3)) return false;
  const d5 = n3(u4[0].value, 1, v2);
  if (!d5 || !isTokenNumber(d5)) return false;
  const y2 = n3(h3[0].value, 2, v2);
  if (!y2 || !isTokenNumber(y2)) return false;
  const _4 = [g3, d5, y2];
  if (1 === N2.length) if (v2.syntaxFlags.add(De.HasAlpha), isTokenNode(N2[0])) {
    const e4 = n3(N2[0].value, 3, v2);
    if (!e4 || !isTokenNumber(e4)) return false;
    _4.push(e4);
  } else v2.alpha = N2[0];
  else if (m3 && m3.has("alpha")) {
    const e4 = n3(m3.get("alpha"), 3, v2);
    if (!e4 || !isTokenNumber(e4)) return false;
    _4.push(e4);
  }
  return v2.channels = [_4[0][4].value, _4[1][4].value, _4[2][4].value], 4 === _4.length && (v2.alpha = _4[3][4].value), v2;
}
function hsl(e3, n3) {
  if (e3.value.some((e4) => isTokenNode(e4) && isTokenComma(e4.value))) {
    const n4 = hslCommaSeparated(e3);
    if (false !== n4) return n4;
  }
  {
    const a3 = hslSpaceSeparated(e3, n3);
    if (false !== a3) return a3;
  }
  return false;
}
function hslCommaSeparated(e3) {
  return threeChannelLegacySyntax(e3, normalize_legacy_HSL_ChannelValues, xe.HSL, [De.LegacyHSL]);
}
function hslSpaceSeparated(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_modern_HSL_ChannelValues, xe.HSL, [], n3);
}
function normalize_HWB_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (0 === l3) {
    const e3 = normalizeHue$1(t3);
    return false !== e3 && (isTokenDimension(t3) && s4.syntaxFlags.add(De.HasDimensionValues), e3);
  }
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 === l3 ? s4.syntaxFlags.add(De.HasPercentageAlpha) : s4.syntaxFlags.add(De.HasPercentageValues), a3 = 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 1, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 3 === l3 ? normalize(t3[4].value, 1, 0, 1) : normalize(t3[4].value, 1, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function normalize_Lab_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 1 === l3 || 2 === l3 ? normalize(t3[4].value, 0.8, -2147483647, 2147483647) : 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 1, 0, 100), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 1 === l3 || 2 === l3 ? normalize(t3[4].value, 1, -2147483647, 2147483647) : normalize(t3[4].value, 1, 0, 3 === l3 ? 1 : 100), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function lab(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_Lab_ChannelValues, xe.Lab, [], n3);
}
function normalize_LCH_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (2 === l3) {
    const e3 = normalizeHue$1(t3);
    return false !== e3 && (isTokenDimension(t3) && s4.syntaxFlags.add(De.HasDimensionValues), e3);
  }
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 1 === l3 ? normalize(t3[4].value, 100 / 150, 0, 2147483647) : 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 1, 0, 100), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = normalize(t3[4].value, 1, 0, 1 === l3 ? 2147483647 : 3 === l3 ? 1 : 100), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function lch(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_LCH_ChannelValues, xe.LCH, [], n3);
}
var Fe = /* @__PURE__ */ new Map();
for (const [e3, n3] of Object.entries(G3)) Fe.set(e3, n3);
function namedColor(e3) {
  const n3 = Fe.get(toLowerCaseAZ2(e3));
  return !!n3 && { colorNotation: xe.RGB, channels: [n3[0] / 255, n3[1] / 255, n3[2] / 255], alpha: 1, syntaxFlags: /* @__PURE__ */ new Set([De.ColorKeyword, De.NamedColor]) };
}
function normalize_OKLab_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 1 === l3 || 2 === l3 ? normalize(t3[4].value, 250, -2147483647, 2147483647) : normalize(t3[4].value, 100, 0, 1), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 1 === l3 || 2 === l3 ? normalize(t3[4].value, 1, -2147483647, 2147483647) : normalize(t3[4].value, 1, 0, 1), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function oklab(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_OKLab_ChannelValues, xe.OKLab, [], n3);
}
function normalize_OKLCH_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === toLowerCaseAZ2(t3[4].value)) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (2 === l3) {
    const e3 = normalizeHue$1(t3);
    return false !== e3 && (isTokenDimension(t3) && s4.syntaxFlags.add(De.HasDimensionValues), e3);
  }
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 1 === l3 ? normalize(t3[4].value, 250, 0, 2147483647) : normalize(t3[4].value, 100, 0, 1), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = normalize(t3[4].value, 1, 0, 1 === l3 ? 2147483647 : 1), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function oklch(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_OKLCH_ChannelValues, xe.OKLCH, [], n3);
}
function normalize_legacy_sRGB_ChannelValues(a3, t3, l3) {
  if (isTokenPercentage(a3)) {
    3 === t3 ? l3.syntaxFlags.add(De.HasPercentageAlpha) : l3.syntaxFlags.add(De.HasPercentageValues);
    const o3 = normalize(a3[4].value, 100, 0, 1);
    return [u.Number, o3.toString(), a3[2], a3[3], { value: o3, type: a.Number }];
  }
  if (isTokenNumber(a3)) {
    let o3;
    return 3 !== t3 && l3.syntaxFlags.add(De.HasNumberValues), o3 = normalize(a3[4].value, 3 === t3 ? 1 : 255, 0, 1), [u.Number, o3.toString(), a3[2], a3[3], { value: o3, type: a.Number }];
  }
  return false;
}
function normalize_modern_sRGB_ChannelValues(t3, l3, s4) {
  if (isTokenIdent(t3) && "none" === t3[4].value.toLowerCase()) return s4.syntaxFlags.add(De.HasNoneKeywords), [u.Number, "none", t3[2], t3[3], { value: Number.NaN, type: a.Number }];
  if (isTokenPercentage(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasPercentageValues), a3 = 3 === l3 ? normalize(t3[4].value, 100, 0, 1) : normalize(t3[4].value, 100, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  if (isTokenNumber(t3)) {
    let a3;
    return 3 !== l3 && s4.syntaxFlags.add(De.HasNumberValues), a3 = 3 === l3 ? normalize(t3[4].value, 1, 0, 1) : normalize(t3[4].value, 255, -2147483647, 2147483647), [u.Number, a3.toString(), t3[2], t3[3], { value: a3, type: a.Number }];
  }
  return false;
}
function rgb(e3, n3) {
  if (e3.value.some((e4) => isTokenNode(e4) && isTokenComma(e4.value))) {
    const n4 = rgbCommaSeparated(e3);
    if (false !== n4) return (!n4.syntaxFlags.has(De.HasNumberValues) || !n4.syntaxFlags.has(De.HasPercentageValues)) && n4;
  } else {
    const a3 = rgbSpaceSeparated(e3, n3);
    if (false !== a3) return a3;
  }
  return false;
}
function rgbCommaSeparated(e3) {
  return threeChannelLegacySyntax(e3, normalize_legacy_sRGB_ChannelValues, xe.RGB, [De.LegacyRGB]);
}
function rgbSpaceSeparated(e3, n3) {
  return threeChannelSpaceSeparated(e3, normalize_modern_sRGB_ChannelValues, xe.RGB, [], n3);
}
function XYZ_D65_to_sRGB_Gamut(e3) {
  const n3 = XYZ_D65_to_sRGB(e3);
  if (inGamut(n3)) return clip(n3);
  let a3 = e3;
  return a3 = XYZ_D65_to_OKLCH(a3), a3[0] < 1e-6 && (a3 = [0, 0, 0]), a3[0] > 0.999999 && (a3 = [1, 0, 0]), gam_sRGB(mapGamutRayTrace(a3, oklch_to_lin_srgb, lin_srgb_to_oklch));
}
function oklch_to_lin_srgb(e3) {
  return e3 = OKLCH_to_OKLab(e3), e3 = OKLab_to_XYZ(e3), XYZ_to_lin_sRGB(e3);
}
function lin_srgb_to_oklch(e3) {
  return e3 = lin_sRGB_to_XYZ(e3), e3 = XYZ_to_OKLab(e3), OKLab_to_OKLCH(e3);
}
function contrastColor(e3, n3) {
  let a3 = false;
  for (let o4 = 0; o4 < e3.value.length; o4++) {
    const r4 = e3.value[o4];
    if (!isWhitespaceNode(r4) && !isCommentNode(r4) && (a3 || (a3 = n3(r4), !a3))) return false;
  }
  if (!a3) return false;
  a3.channels = convertNaNToZero(a3.channels), a3.channels = XYZ_D65_to_sRGB_Gamut(colorData_to_XYZ_D65(a3).channels), a3.colorNotation = xe.sRGB;
  const o3 = { colorNotation: xe.RGB, channels: [0, 0, 0], alpha: 1, syntaxFlags: /* @__PURE__ */ new Set([De.ContrastColor, De.Experimental]) }, r3 = contrast_ratio_wcag_2_1(a3.channels, [1, 1, 1]), t3 = contrast_ratio_wcag_2_1(a3.channels, [0, 0, 0]);
  return o3.channels = r3 > t3 ? [1, 1, 1] : [0, 0, 0], o3;
}
function alpha(e3, n3) {
  let o3, s4, c4 = false, i3 = false, u4 = false;
  const h3 = { colorNotation: xe.sRGB, channels: [0, 0, 0], alpha: 1, syntaxFlags: /* @__PURE__ */ new Set([]) };
  for (let N2 = 0; N2 < e3.value.length; N2++) {
    let m3 = e3.value[N2];
    if (isWhitespaceNode(m3) || isCommentNode(m3)) for (; isWhitespaceNode(e3.value[N2 + 1]) || isCommentNode(e3.value[N2 + 1]); ) N2++;
    else if (u4 && !c4 && !i3 && isTokenNode(m3) && isTokenDelim(m3.value) && "/" === m3.value[4].value) c4 = true;
    else {
      if (isFunctionNode(m3) && Q.has(toLowerCaseAZ2(m3.getName()))) {
        const [[e4]] = calcFromComponentValues([[m3]], { censorIntoStandardRepresentableValues: true, globals: s4, precision: -1, toCanonicalUnits: true, rawPercentages: true });
        if (!e4 || !isTokenNode(e4) || !isTokenNumeric(e4.value)) return false;
        Number.isNaN(e4.value[4].value) && (e4.value[4].value = 0), m3 = e4;
      }
      if (c4 || i3 || !isTokenNode(m3) || !isTokenIdent(m3.value) || "from" !== toLowerCaseAZ2(m3.value[4].value)) {
        if (!c4) return false;
        if (i3) return false;
        if (isTokenNode(m3)) {
          if (isTokenIdent(m3.value) && "alpha" === toLowerCaseAZ2(m3.value[4].value) && o3 && o3.has("alpha")) {
            h3.alpha = o3.get("alpha")[4].value, i3 = true;
            continue;
          }
          const e4 = normalize_Color_ChannelValues(m3.value, 3, h3);
          if (!e4 || !isTokenNumber(e4)) return false;
          h3.alpha = e4[4].value, i3 = true;
          continue;
        }
        if (isFunctionNode(m3)) {
          const e4 = replaceComponentValues([[m3]], (e5) => {
            if (isTokenNode(e5) && isTokenIdent(e5.value) && "alpha" === toLowerCaseAZ2(e5.value[4].value) && o3 && o3.has("alpha")) return new TokenNode(o3.get("alpha"));
          });
          h3.alpha = e4[0][0], i3 = true;
          continue;
        }
        return false;
      }
      if (u4) return false;
      for (; isWhitespaceNode(e3.value[N2 + 1]) || isCommentNode(e3.value[N2 + 1]); ) N2++;
      if (N2++, m3 = e3.value[N2], u4 = n3(m3), false === u4) return false;
      o3 = normalizeRelativeColorDataChannels(u4), s4 = noneToZeroInRelativeColorDataChannels(o3), h3.syntaxFlags = new Set(u4.syntaxFlags), h3.syntaxFlags.add(De.RelativeAlphaSyntax), h3.channels = [...u4.channels], h3.colorNotation = u4.colorNotation, h3.alpha = u4.alpha;
    }
  }
  return !!o3 && (!!i3 && h3);
}
function color(e3) {
  if (isFunctionNode(e3)) {
    switch (toLowerCaseAZ2(e3.getName())) {
      case "rgb":
      case "rgba":
        return rgb(e3, color);
      case "hsl":
      case "hsla":
        return hsl(e3, color);
      case "hwb":
        return n3 = color, threeChannelSpaceSeparated(e3, normalize_HWB_ChannelValues, xe.HWB, [], n3);
      case "lab":
        return lab(e3, color);
      case "lch":
        return lch(e3, color);
      case "oklab":
        return oklab(e3, color);
      case "oklch":
        return oklch(e3, color);
      case "color":
        return color$1(e3, color);
      case "color-mix":
        return colorMix(e3, color);
      case "contrast-color":
        return contrastColor(e3, color);
      case "alpha":
        return alpha(e3, color);
    }
  }
  var n3;
  if (isTokenNode(e3)) {
    if (isTokenHash(e3.value)) return hex(e3.value);
    if (isTokenIdent(e3.value)) {
      const n4 = namedColor(e3.value[4].value);
      return false !== n4 ? n4 : "transparent" === toLowerCaseAZ2(e3.value[4].value) && { colorNotation: xe.RGB, channels: [0, 0, 0], alpha: 0, syntaxFlags: /* @__PURE__ */ new Set([De.ColorKeyword]) };
    }
  }
  return false;
}

// ../../sessions/rcw-01spxpk3gyesqcqjm4mwdnrr/sync_runner/node_modules/@asamuzakjp/css-color/dist/esm/index.js
var s3 = 4096;
var c3 = class {
  #e;
  constructor(e3) {
    this.#e = e3;
  }
  get item() {
    return this.#e;
  }
};
var l2 = new I2({ max: s3 });
var u3 = (e3, t3) => {
  e3 && (t3 instanceof c3 ? l2.set(e3, t3) : l2.set(e3, new c3(t3)));
};
var d4 = (e3) => {
  if (!e3) return false;
  let t3 = l2.get(e3);
  return t3 !== void 0 && t3;
};
var f3 = (e3) => {
  let t3 = Object.keys(e3);
  if (t3.length === 0) return "";
  t3.sort();
  let n3 = "";
  for (let r3 of t3) n3 += `${r3}:${JSON.stringify(e3[r3])};`;
  return n3;
};
var p = (e3, t3 = {}) => {
  if (!e3 || t3.customProperty && typeof t3.customProperty.callback == "function" || t3.dimension && typeof t3.dimension.callback == "function") return "";
  let n3 = e3.namespace || "", r3 = e3.name || "", i3 = e3.value || "";
  return !n3 && !r3 && !i3 ? "" : `${`${n3}:${r3}:${i3}`}::${`${t3.format || ""}|${t3.colorSpace || ""}|${t3.colorScheme || ""}|${t3.currentColor || ""}|${t3.d50 ? "1" : "0"}|${t3.nullable ? "1" : "0"}|${t3.preserveComment ? "1" : "0"}|${t3.delimiter || ""}`}::${t3.customProperty ? f3(t3.customProperty) : ""}::${t3.dimension ? f3(t3.dimension) : ""}`;
};
var m2 = (e3) => typeof e3 == "string" || e3 instanceof String;
var h2 = (e3) => m2(e3) || typeof e3 == "number";
var { CloseParen: g2, Comma: _3, Comment: v, Delim: y, EOF: b2, Function: x3, OpenParen: S2, Whitespace: C2 } = u;
var w = "util";
var T3 = 10;
var E = 16;
var D2 = 360;
var O3 = 180;
var ee = /--[\w-]+/g;
var te = /^,$/;
var ne = /^\/$/;
var re = /^\s+$/;
var k3 = (e3, t3 = {}) => {
  if (!m2(e3)) throw TypeError(`${e3} is not a string.`);
  let r3 = e3.trim(), { delimiter: i3 = " ", preserveComment: a3 = false } = t3, o3 = p({
    namespace: w,
    name: "splitValue",
    value: r3
  }, {
    delimiter: i3,
    preserveComment: a3
  }), s4 = d4(o3);
  if (s4 instanceof c3) return s4.item;
  let l3;
  switch (i3) {
    case ",":
      l3 = te;
      break;
    case "/":
      l3 = ne;
      break;
    default:
      l3 = re;
  }
  let f4 = tokenize({ css: r3 }), h3 = 0, T4 = "", E2 = [];
  for (let [e4, t4] of f4) switch (e4) {
    case _3:
    case y:
      h3 === 0 && l3.test(t4) ? (E2.push(T4.trim()), T4 = "") : T4 += t4;
      break;
    case v:
      a3 && (i3 === "," || i3 === "/") && (T4 += t4);
      break;
    case x3:
    case S2:
      T4 += t4, h3++;
      break;
    case g2:
      T4 += t4, h3--;
      break;
    case C2:
      l3.test(t4) ? h3 === 0 ? T4 &&= (E2.push(T4.trim()), "") : T4 += " " : T4.endsWith(" ") || (T4 += " ");
      break;
    default:
      e4 === b2 ? (E2.push(T4.trim()), T4 = "") : T4 += t4;
  }
  return u3(o3, E2), E2;
};
var ie = (e3) => {
  if (!m2(e3)) throw TypeError(`${e3} is not a string.`);
  let t3 = e3.trim(), n3 = p({
    namespace: w,
    name: "extractDashedIdent",
    value: t3
  }), r3 = d4(n3);
  if (r3 instanceof c3) return r3.item;
  let i3 = t3.match(ee), a3 = i3 ? [...new Set(i3)] : [];
  return u3(n3, a3), a3;
};
var A = (e3, t3 = 0) => {
  if (!Number.isFinite(e3)) throw TypeError(`${e3} is not a finite number.`);
  if (!Number.isFinite(t3)) throw TypeError(`${t3} is not a finite number.`);
  if (t3 < 0 || t3 > E) throw RangeError(`${t3} is not between 0 and ${E}.`);
  if (t3 === 0) return Math.round(e3);
  let n3 = t3 === E ? 6 : t3 < T3 ? 4 : 5;
  return parseFloat(e3.toPrecision(n3));
};
var ae = (e3, t3, n3 = "shorter") => {
  if (!Number.isFinite(e3)) throw TypeError(`${e3} is not a finite number.`);
  if (!Number.isFinite(t3)) throw TypeError(`${t3} is not a finite number.`);
  let r3 = e3, i3 = t3;
  switch (n3) {
    case "decreasing":
      i3 > r3 && (r3 += D2);
      break;
    case "increasing":
      i3 < r3 && (i3 += D2);
      break;
    case "longer":
      i3 > r3 && i3 < r3 + O3 ? r3 += D2 : i3 > r3 - O3 && i3 <= r3 && (i3 += D2);
      break;
    default:
      i3 > r3 + O3 ? r3 += D2 : i3 < r3 - O3 && (i3 += D2);
  }
  return [r3, i3];
};
var j3 = /* @__PURE__ */ new Map([
  ["xx-small", 9 / 16],
  ["x-small", 5 / 8],
  ["small", 13 / 16],
  ["medium", 1],
  ["large", 9 / 8],
  ["x-large", 3 / 2],
  ["xx-large", 2],
  ["xxx-large", 3]
]);
var M3 = /* @__PURE__ */ new Map([["smaller", 1 / 1.2], ["larger", 1.2]]);
var N = /* @__PURE__ */ new Map([
  ["cm", 96 / 2.54],
  ["mm", 96 / 25.4],
  ["q", 96 / 101.6],
  ["in", 96],
  ["pc", 16],
  ["pt", 96 / 72],
  ["px", 1]
]);
var P3 = /* @__PURE__ */ new Map([
  ["rcap", 1],
  ["rch", 0.5],
  ["rem", 1],
  ["rex", 0.5],
  ["ric", 1],
  ["rlh", 1.2]
]);
var F = (e3, t3, n3 = {}) => {
  let { dimension: r3 = {} } = n3, { callback: i3, em: a3, rem: o3, vh: s4, vw: c4 } = r3;
  if (m2(e3)) {
    let t4 = e3.toLowerCase().trim(), n4 = j3.get(t4);
    if (n4 !== void 0) return n4 * o3;
    let r4 = M3.get(t4);
    return r4 === void 0 ? NaN : r4 * a3;
  }
  if (Number.isFinite(e3) && t3) {
    let n4 = t3.toLowerCase();
    if (Object.hasOwn(r3, n4)) return e3 * Number(r3[n4]);
    if (typeof i3 == "function") return e3 * (i3(n4) ?? NaN);
    let l3 = N.get(n4);
    if (l3 !== void 0) return e3 * l3;
    let u4 = P3.get(n4);
    if (u4 !== void 0) return e3 * u4 * o3;
    let d5 = P3.get(`r${n4}`);
    if (d5 !== void 0) return e3 * d5 * a3;
    switch (n4) {
      case "vb":
        return e3 * s4;
      case "vi":
        return e3 * c4;
      case "vmax":
        return e3 * Math.max(s4, c4);
      case "vmin":
        return e3 * Math.min(s4, c4);
    }
  }
  return NaN;
};
var oe = "(?:0|[1-9]\\d*)";
var se = "clamp|max|min|exp|hypot|log|pow|sqrt|abs|sign|mod|rem|round|a?(?:cos|sin|tan)|atan2";
var ce = `calc|${se}`;
var le = `var|${ce}`;
var ue = "deg|g?rad|turn";
var de = "[cm]m|[dls]?v(?:[bhiw]|max|min)|in|p[ctx]|q|r?(?:[cl]h|cap|e[mx]|ic)";
var I3 = `[+-]?(?:${oe}(?:\\.\\d*)?|\\.\\d+)(?:e-?${oe})?`;
var fe = `\\+?(?:${oe}(?:\\.\\d*)?|\\.\\d+)(?:e-?${oe})?`;
var L3 = "none";
var R3 = `${I3}%`;
var pe = `^(?:${ce})\\(|(?<=[*\\/\\s\\(])(?:${ce})\\(`;
var me = `^(?:${se})\\($`;
var he = "^var\\(|(?<=[*\\/\\s\\(])var\\(";
var ge = `^(?:${le})\\(`;
var _e = `(?:\\s*\\/\\s*(?:${I3}|${R3}|${L3}))?`;
var ve = `(?:\\s*,\\s*(?:${I3}|${R3}))?`;
var ye = "(?:ok)?l(?:ab|ch)|color|hsla?|hwb|rgba?";
var be = "[a-z]+|#[\\da-f]{3}|#[\\da-f]{4}|#[\\da-f]{6}|#[\\da-f]{8}";
var xe2 = "(?:ok)?lch|hsl|hwb";
var Se = "(?:de|in)creasing|longer|shorter";
var Ce = `${I3}(?:${ue})?`;
var we = `(?:${I3}(?:${ue})?|${L3})`;
var Te = `(?:${I3}|${R3}|${L3})`;
var Ee = `(?:${xe2})(?:\\s(?:${Se})\\shue)?`;
var De2 = `(${xe2})(?:\\s(${Se})\\shue)?`;
var Oe = "(?:ok)?lab";
var ke = "(?:ok)?lch";
var Ae = "(?:a98|prophoto)-rgb|display-p3|rec2020|srgb(?:-linear)?";
var je = "xyz(?:-d(?:50|65))?";
var Me2 = `${Oe}|${Ae}|${je}`;
var Ne = `${Ee}|${Me2}`;
var Pe2 = "color-mix(";
var Fe2 = `(?:${ye})\\(\\s*from\\s+`;
var Ie = `(${ye})\\(\\s*from\\s+`;
var Le2 = "var(";
var Re = `(?:${Ae}|${je})(?:\\s+${Te}){3}${_e}`;
var ze = "^light-dark\\(";
var Be = `^${Fe2}|(?<=[\\s])${Fe2}`;
var Ve = `${we}(?:\\s+${Te}){2}${_e}`;
var He2 = `${Ce}(?:\\s*,\\s*${R3}){2}${ve}`;
var Ue = `(?:${Te}\\s+){2}${we}${_e}`;
var We = `${Te}(?:\\s+${Te}){2}${_e}`;
var Ge = `(?:${I3}(?:\\s*,\\s*${I3}){2}|${R3}(?:\\s*,\\s*${R3}){2})${ve}`;
var Ke = `${be}|hsla?\\(\\s*${He2}\\s*\\)|rgba?\\(\\s*${Ge}\\s*\\)|(?:hsla?|hwb)\\(\\s*${Ve}\\s*\\)|(?:(?:ok)?lab|rgba?)\\(\\s*${We}\\s*\\)|(?:ok)?lch\\(\\s*${Ue}\\s*\\)|color\\(\\s*${Re}\\s*\\)`;
var qe = `(?:${Ke})(?:\\s+${R3})?`;
var Je = `color-mix\\(\\s*in\\s+(?:${Ne})\\s*,\\s*${qe}\\s*,\\s*${qe}\\s*\\)`;
var Ye = `color-mix\\(\\s*in\\s+(${Ne})\\s*,\\s*(${qe})\\s*,\\s*(${qe})\\s*\\)`;
var z2 = "computedValue";
var B = "mixValue";
var Xe = "specifiedValue";
var Ze2 = "color";
var Qe = 1e-3;
var $e2 = 0.5;
var et = 2;
var V2 = 3;
var tt = 4;
var nt = 8;
var rt = 10;
var it = 12;
var H3 = 16;
var at = 60;
var ot = 180;
var st = 360;
var U3 = 100;
var W3 = 255;
var ct = 2;
var lt = 3;
var ut = 2.4;
var dt = 12.92;
var ft = 0.055;
var pt = 116;
var mt = 500;
var ht = 200;
var gt = 216 / 24389;
var _t = 24389 / 27;
var vt = [
  0.3457 / 0.3585,
  1,
  0.2958 / 0.3585
];
var yt = [
  [
    0.955473421488075,
    -0.02309845494876471,
    0.06325924320057072
  ],
  [
    -0.0283697093338637,
    1.0099953980813041,
    0.021041441191917323
  ],
  [
    0.012314014864481998,
    -0.020507649298898964,
    1.330365926242124
  ]
];
var bt = [
  [
    1.0479297925449969,
    0.022946870601609652,
    -0.05019226628920524
  ],
  [
    0.02962780877005599,
    0.9904344267538799,
    -0.017073799063418826
  ],
  [
    -0.009243040646204504,
    0.015055191490298152,
    0.7518742814281371
  ]
];
var xt = [
  [
    506752 / 1228815,
    87881 / 245763,
    12673 / 70218
  ],
  [
    87098 / 409605,
    175762 / 245763,
    12673 / 175545
  ],
  [
    7918 / 409605,
    87881 / 737289,
    1001167 / 1053270
  ]
];
var St = [
  [
    12831 / 3959,
    -329 / 214,
    -1974 / 3959
  ],
  [
    -851781 / 878810,
    1648619 / 878810,
    36519 / 878810
  ],
  [
    705 / 12673,
    -2585 / 12673,
    705 / 667
  ]
];
var Ct = [
  [
    0.819022437996703,
    0.3619062600528904,
    -0.1288737815209879
  ],
  [
    0.0329836539323885,
    0.9292868615863434,
    0.0361446663506424
  ],
  [
    0.0481771893596242,
    0.2642395317527308,
    0.6335478284694309
  ]
];
var wt = [
  [
    1.2268798758459243,
    -0.5578149944602171,
    0.2813910456659647
  ],
  [
    -0.0405757452148008,
    1.112286803280317,
    -0.0717110580655164
  ],
  [
    -0.0763729366746601,
    -0.4214933324022432,
    1.5869240198367816
  ]
];
var Tt = [
  [
    1,
    0.3963377773761749,
    0.2158037573099136
  ],
  [
    1,
    -0.1055613458156586,
    -0.0638541728258133
  ],
  [
    1,
    -0.0894841775298119,
    -1.2914855480194092
  ]
];
var Et = [
  [
    0.210454268309314,
    0.7936177747023054,
    -0.0040720430116193
  ],
  [
    1.9779985324311684,
    -2.42859224204858,
    0.450593709617411
  ],
  [
    0.0259040424655478,
    0.7827717124575296,
    -0.8086757549230774
  ]
];
var Dt = [
  [
    608311 / 1250200,
    189793 / 714400,
    198249 / 1000160
  ],
  [
    35783 / 156275,
    247089 / 357200,
    198249 / 2500400
  ],
  [
    0,
    32229 / 714400,
    5220557 / 5000800
  ]
];
var Ot = [
  [
    63426534 / 99577255,
    20160776 / 139408157,
    47086771 / 278816314
  ],
  [
    26158966 / 99577255,
    472592308 / 697040785,
    8267143 / 139408157
  ],
  [
    0,
    19567812 / 697040785,
    295819943 / 278816314
  ]
];
var kt = [
  [
    573536 / 994567,
    263643 / 1420810,
    187206 / 994567
  ],
  [
    591459 / 1989134,
    6239551 / 9945670,
    374412 / 4972835
  ],
  [
    53769 / 1989134,
    351524 / 4972835,
    4929758 / 4972835
  ]
];
var At = [
  [
    0.7977666449006423,
    0.13518129740053308,
    0.0313477341283922
  ],
  [
    0.2880748288194013,
    0.711835234241873,
    8993693872564e-17
  ],
  [
    0,
    0,
    0.8251046025104602
  ]
];
var jt = RegExp(`^(?:${Ke})$`);
var Mt = RegExp(`^${De2}$`);
var Nt = /^xyz(?:-d(?:50|65))?$/;
var G4 = /^currentColor$/i;
var Pt = RegExp(`^color\\(\\s*(${Re})\\s*\\)$`);
var Ft = RegExp(`^hsla?\\(\\s*(${Ve}|${He2})\\s*\\)$`);
var It = RegExp(`^hwb\\(\\s*(${Ve})\\s*\\)$`);
var Lt = RegExp(`^lab\\(\\s*(${We})\\s*\\)$`);
var Rt = RegExp(`^lch\\(\\s*(${Ue})\\s*\\)$`);
var zt = RegExp(`^${Je}$`);
var Bt = RegExp(`^${Ye}$`);
var Vt = RegExp(`${Je}`, "g");
var Ht = RegExp(`^oklab\\(\\s*(${We})\\s*\\)$`);
var Ut = RegExp(`^oklch\\(\\s*(${Ue})\\s*\\)$`);
var K2 = /^(?:specifi|comput)edValue$/;
var Wt = RegExp(`^(${I3})(${ue})?$`);
var Gt = RegExp(`^rgba?\\(\\s*(${We}|${Ge})\\s*\\)$`);
var Kt = RegExp(`^(?:${Ae}|${je})$`);
var qt = RegExp(`in\\s+(${Ne})`);
var Jt = RegExp(`^color-mix\\(\\s*in\\s+(${Ne})\\s*,`);
var Yt = RegExp(`^(${Ke})(?:\\s+(${R3}))?$`);
var Xt = {
  aliceblue: [
    240,
    248,
    255
  ],
  antiquewhite: [
    250,
    235,
    215
  ],
  aqua: [
    0,
    255,
    255
  ],
  aquamarine: [
    127,
    255,
    212
  ],
  azure: [
    240,
    255,
    255
  ],
  beige: [
    245,
    245,
    220
  ],
  bisque: [
    255,
    228,
    196
  ],
  black: [
    0,
    0,
    0
  ],
  blanchedalmond: [
    255,
    235,
    205
  ],
  blue: [
    0,
    0,
    255
  ],
  blueviolet: [
    138,
    43,
    226
  ],
  brown: [
    165,
    42,
    42
  ],
  burlywood: [
    222,
    184,
    135
  ],
  cadetblue: [
    95,
    158,
    160
  ],
  chartreuse: [
    127,
    255,
    0
  ],
  chocolate: [
    210,
    105,
    30
  ],
  coral: [
    255,
    127,
    80
  ],
  cornflowerblue: [
    100,
    149,
    237
  ],
  cornsilk: [
    255,
    248,
    220
  ],
  crimson: [
    220,
    20,
    60
  ],
  cyan: [
    0,
    255,
    255
  ],
  darkblue: [
    0,
    0,
    139
  ],
  darkcyan: [
    0,
    139,
    139
  ],
  darkgoldenrod: [
    184,
    134,
    11
  ],
  darkgray: [
    169,
    169,
    169
  ],
  darkgreen: [
    0,
    100,
    0
  ],
  darkgrey: [
    169,
    169,
    169
  ],
  darkkhaki: [
    189,
    183,
    107
  ],
  darkmagenta: [
    139,
    0,
    139
  ],
  darkolivegreen: [
    85,
    107,
    47
  ],
  darkorange: [
    255,
    140,
    0
  ],
  darkorchid: [
    153,
    50,
    204
  ],
  darkred: [
    139,
    0,
    0
  ],
  darksalmon: [
    233,
    150,
    122
  ],
  darkseagreen: [
    143,
    188,
    143
  ],
  darkslateblue: [
    72,
    61,
    139
  ],
  darkslategray: [
    47,
    79,
    79
  ],
  darkslategrey: [
    47,
    79,
    79
  ],
  darkturquoise: [
    0,
    206,
    209
  ],
  darkviolet: [
    148,
    0,
    211
  ],
  deeppink: [
    255,
    20,
    147
  ],
  deepskyblue: [
    0,
    191,
    255
  ],
  dimgray: [
    105,
    105,
    105
  ],
  dimgrey: [
    105,
    105,
    105
  ],
  dodgerblue: [
    30,
    144,
    255
  ],
  firebrick: [
    178,
    34,
    34
  ],
  floralwhite: [
    255,
    250,
    240
  ],
  forestgreen: [
    34,
    139,
    34
  ],
  fuchsia: [
    255,
    0,
    255
  ],
  gainsboro: [
    220,
    220,
    220
  ],
  ghostwhite: [
    248,
    248,
    255
  ],
  gold: [
    255,
    215,
    0
  ],
  goldenrod: [
    218,
    165,
    32
  ],
  gray: [
    128,
    128,
    128
  ],
  green: [
    0,
    128,
    0
  ],
  greenyellow: [
    173,
    255,
    47
  ],
  grey: [
    128,
    128,
    128
  ],
  honeydew: [
    240,
    255,
    240
  ],
  hotpink: [
    255,
    105,
    180
  ],
  indianred: [
    205,
    92,
    92
  ],
  indigo: [
    75,
    0,
    130
  ],
  ivory: [
    255,
    255,
    240
  ],
  khaki: [
    240,
    230,
    140
  ],
  lavender: [
    230,
    230,
    250
  ],
  lavenderblush: [
    255,
    240,
    245
  ],
  lawngreen: [
    124,
    252,
    0
  ],
  lemonchiffon: [
    255,
    250,
    205
  ],
  lightblue: [
    173,
    216,
    230
  ],
  lightcoral: [
    240,
    128,
    128
  ],
  lightcyan: [
    224,
    255,
    255
  ],
  lightgoldenrodyellow: [
    250,
    250,
    210
  ],
  lightgray: [
    211,
    211,
    211
  ],
  lightgreen: [
    144,
    238,
    144
  ],
  lightgrey: [
    211,
    211,
    211
  ],
  lightpink: [
    255,
    182,
    193
  ],
  lightsalmon: [
    255,
    160,
    122
  ],
  lightseagreen: [
    32,
    178,
    170
  ],
  lightskyblue: [
    135,
    206,
    250
  ],
  lightslategray: [
    119,
    136,
    153
  ],
  lightslategrey: [
    119,
    136,
    153
  ],
  lightsteelblue: [
    176,
    196,
    222
  ],
  lightyellow: [
    255,
    255,
    224
  ],
  lime: [
    0,
    255,
    0
  ],
  limegreen: [
    50,
    205,
    50
  ],
  linen: [
    250,
    240,
    230
  ],
  magenta: [
    255,
    0,
    255
  ],
  maroon: [
    128,
    0,
    0
  ],
  mediumaquamarine: [
    102,
    205,
    170
  ],
  mediumblue: [
    0,
    0,
    205
  ],
  mediumorchid: [
    186,
    85,
    211
  ],
  mediumpurple: [
    147,
    112,
    219
  ],
  mediumseagreen: [
    60,
    179,
    113
  ],
  mediumslateblue: [
    123,
    104,
    238
  ],
  mediumspringgreen: [
    0,
    250,
    154
  ],
  mediumturquoise: [
    72,
    209,
    204
  ],
  mediumvioletred: [
    199,
    21,
    133
  ],
  midnightblue: [
    25,
    25,
    112
  ],
  mintcream: [
    245,
    255,
    250
  ],
  mistyrose: [
    255,
    228,
    225
  ],
  moccasin: [
    255,
    228,
    181
  ],
  navajowhite: [
    255,
    222,
    173
  ],
  navy: [
    0,
    0,
    128
  ],
  oldlace: [
    253,
    245,
    230
  ],
  olive: [
    128,
    128,
    0
  ],
  olivedrab: [
    107,
    142,
    35
  ],
  orange: [
    255,
    165,
    0
  ],
  orangered: [
    255,
    69,
    0
  ],
  orchid: [
    218,
    112,
    214
  ],
  palegoldenrod: [
    238,
    232,
    170
  ],
  palegreen: [
    152,
    251,
    152
  ],
  paleturquoise: [
    175,
    238,
    238
  ],
  palevioletred: [
    219,
    112,
    147
  ],
  papayawhip: [
    255,
    239,
    213
  ],
  peachpuff: [
    255,
    218,
    185
  ],
  peru: [
    205,
    133,
    63
  ],
  pink: [
    255,
    192,
    203
  ],
  plum: [
    221,
    160,
    221
  ],
  powderblue: [
    176,
    224,
    230
  ],
  purple: [
    128,
    0,
    128
  ],
  rebeccapurple: [
    102,
    51,
    153
  ],
  red: [
    255,
    0,
    0
  ],
  rosybrown: [
    188,
    143,
    143
  ],
  royalblue: [
    65,
    105,
    225
  ],
  saddlebrown: [
    139,
    69,
    19
  ],
  salmon: [
    250,
    128,
    114
  ],
  sandybrown: [
    244,
    164,
    96
  ],
  seagreen: [
    46,
    139,
    87
  ],
  seashell: [
    255,
    245,
    238
  ],
  sienna: [
    160,
    82,
    45
  ],
  silver: [
    192,
    192,
    192
  ],
  skyblue: [
    135,
    206,
    235
  ],
  slateblue: [
    106,
    90,
    205
  ],
  slategray: [
    112,
    128,
    144
  ],
  slategrey: [
    112,
    128,
    144
  ],
  snow: [
    255,
    250,
    250
  ],
  springgreen: [
    0,
    255,
    127
  ],
  steelblue: [
    70,
    130,
    180
  ],
  tan: [
    210,
    180,
    140
  ],
  teal: [
    0,
    128,
    128
  ],
  thistle: [
    216,
    191,
    216
  ],
  tomato: [
    255,
    99,
    71
  ],
  turquoise: [
    64,
    224,
    208
  ],
  violet: [
    238,
    130,
    238
  ],
  wheat: [
    245,
    222,
    179
  ],
  white: [
    255,
    255,
    255
  ],
  whitesmoke: [
    245,
    245,
    245
  ],
  yellow: [
    255,
    255,
    0
  ],
  yellowgreen: [
    154,
    205,
    50
  ]
};
var q2 = (e3, t3, n3 = false) => {
  if (t3 === "specifiedValue") return u3(e3, ""), "";
  if (n3) return u3(e3, null), null;
  let r3 = [
    "rgb",
    0,
    0,
    0,
    0
  ];
  return u3(e3, r3), r3;
};
var Zt = (e3, t3 = false) => {
  switch (e3) {
    case "hsl":
    case "hwb":
    case B:
      return null;
    case Xe:
      return "";
    default:
      return t3 ? null : [
        "rgb",
        0,
        0,
        0,
        0
      ];
  }
};
var Qt = (e3, t3 = {}) => {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  let { alpha: n3 = false, minLength: r3 = V2, maxLength: i3 = tt, minRange: a3 = 0, maxRange: o3 = 1, validateRange: s4 = true } = t3;
  if (!Number.isFinite(r3)) throw TypeError(`${r3} is not a number.`);
  if (!Number.isFinite(i3)) throw TypeError(`${i3} is not a number.`);
  if (!Number.isFinite(a3)) throw TypeError(`${a3} is not a number.`);
  if (!Number.isFinite(o3)) throw TypeError(`${o3} is not a number.`);
  let c4 = e3.length;
  if (c4 < r3 || c4 > i3) throw Error(`Unexpected array length ${c4}.`);
  let l3 = 0;
  for (; l3 < c4; ) {
    let t4 = e3[l3];
    if (!Number.isFinite(t4)) throw TypeError(`${t4} is not a number.`);
    if (l3 < V2 && s4 && (t4 < a3 || t4 > o3)) throw RangeError(`${t4} is not between ${a3} and ${o3}.`);
    if (l3 === V2 && (t4 < 0 || t4 > 1)) throw RangeError(`${t4} is not between 0 and 1.`);
    l3++;
  }
  return n3 && c4 === V2 && e3.push(1), e3;
};
var J2 = (e3, t3, n3 = false) => {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  if (e3.length !== V2) throw Error(`Unexpected array length ${e3.length}.`);
  if (!n3) for (let t4 of e3) t4 = Qt(t4, {
    maxLength: V2,
    validateRange: false
  });
  let [[r3, i3, a3], [o3, s4, c4], [l3, u4, d5]] = e3, f4, p2, m3;
  return n3 ? [f4, p2, m3] = t3 : [f4, p2, m3] = Qt(t3, {
    maxLength: V2,
    validateRange: false
  }), [
    r3 * f4 + i3 * p2 + a3 * m3,
    o3 * f4 + s4 * p2 + c4 * m3,
    l3 * f4 + u4 * p2 + d5 * m3
  ];
};
var $t = (e3, t3, n3 = false) => {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  if (e3.length !== tt) throw Error(`Unexpected array length ${e3.length}.`);
  if (!Array.isArray(t3)) throw TypeError(`${t3} is not an array.`);
  if (t3.length !== tt) throw Error(`Unexpected array length ${t3.length}.`);
  let r3 = 0;
  for (; r3 < tt; ) e3[r3] === "none" && t3[r3] === "none" ? (e3[r3] = 0, t3[r3] = 0) : e3[r3] === "none" ? e3[r3] = t3[r3] : t3[r3] === "none" && (t3[r3] = e3[r3]), r3++;
  return n3 ? [e3, t3] : [Qt(e3, {
    minLength: tt,
    validateRange: false
  }), Qt(t3, {
    minLength: tt,
    validateRange: false
  })];
};
var en = (e3) => {
  if (!Number.isFinite(e3)) throw TypeError(`${e3} is not a number.`);
  if (e3 = Math.round(e3), e3 < 0 || e3 > W3) throw RangeError(`${e3} is not between 0 and ${W3}.`);
  let t3 = e3.toString(H3);
  return t3.length === 1 && (t3 = `0${t3}`), t3;
};
var tn = (e3) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let t3 = st / 400, n3 = st / (Math.PI * et);
  if (!Wt.test(e3)) throw SyntaxError(`Invalid property value: ${e3}`);
  let [, r3, i3] = e3.match(Wt), a3;
  switch (i3) {
    case "grad":
      a3 = parseFloat(r3) * t3;
      break;
    case "rad":
      a3 = parseFloat(r3) * n3;
      break;
    case "turn":
      a3 = parseFloat(r3) * st;
      break;
    default:
      a3 = parseFloat(r3);
  }
  return a3 %= st, a3 < 0 ? a3 += st : Object.is(a3, -0) && (a3 = 0), a3;
};
var nn = (e3 = "") => {
  if (m2(e3)) {
    if (e3 = e3.trim(), !e3) e3 = "1";
    else if (e3 === "none") e3 = "0";
    else {
      let t3;
      if (t3 = e3.endsWith("%") ? parseFloat(e3) / U3 : parseFloat(e3), !Number.isFinite(t3)) throw TypeError(`${t3} is not a finite number.`);
      e3 = t3 < Qe ? "0" : t3 > 1 ? "1" : t3.toFixed(V2);
    }
  } else e3 = "1";
  return parseFloat(e3);
};
var rn = (e3) => {
  if (m2(e3)) {
    if (e3 === "") throw SyntaxError("Invalid property value: (empty string)");
    e3 = e3.trim();
  } else throw TypeError(`${e3} is not a string.`);
  let t3 = parseInt(e3, H3);
  if (t3 <= 0) return 0;
  if (t3 >= W3) return 1;
  let n3 = /* @__PURE__ */ new Map();
  for (let e4 = 1; e4 < U3; e4++) n3.set(Math.round(e4 * W3 / U3), e4);
  return t3 = n3.has(t3) ? n3.get(t3) / U3 : Math.round(t3 / W3 / Qe) * Qe, parseFloat(t3.toFixed(V2));
};
var an = (e3, t3 = false) => {
  let n3, r3, i3;
  t3 ? [n3, r3, i3] = e3 : [n3, r3, i3] = Qt(e3, {
    maxLength: V2,
    maxRange: W3
  });
  let a3 = n3 / W3, o3 = r3 / W3, s4 = i3 / W3, c4 = 0.04045;
  return a3 > c4 ? a3 = ((a3 + ft) / 1.055) ** ut : a3 /= dt, o3 > c4 ? o3 = ((o3 + ft) / 1.055) ** ut : o3 /= dt, s4 > c4 ? s4 = ((s4 + ft) / 1.055) ** ut : s4 /= dt, [
    a3,
    o3,
    s4
  ];
};
var on = (e3, t3 = false) => (t3 || (e3 = Qt(e3, {
  maxLength: V2,
  maxRange: W3
})), e3 = an(e3, true), J2(xt, e3, true));
var sn = (e3, t3 = false) => {
  let [n3, r3, i3] = Qt(e3, { maxLength: V2 }), a3 = 809 / 258400;
  return n3 > a3 ? n3 = n3 ** (1 / ut) * 1.055 - ft : n3 *= dt, n3 *= W3, r3 > a3 ? r3 = r3 ** (1 / ut) * 1.055 - ft : r3 *= dt, r3 *= W3, i3 > a3 ? i3 = i3 ** (1 / ut) * 1.055 - ft : i3 *= dt, i3 *= W3, [
    t3 ? Math.round(n3) : n3,
    t3 ? Math.round(r3) : r3,
    t3 ? Math.round(i3) : i3
  ];
};
var cn = (e3, t3 = false) => {
  t3 || (e3 = Qt(e3, {
    maxLength: V2,
    validateRange: false
  }));
  let [n3, r3, i3] = J2(St, e3, true);
  return [n3, r3, i3] = sn([
    Math.min(Math.max(n3, 0), 1),
    Math.min(Math.max(r3, 0), 1),
    Math.min(Math.max(i3, 0), 1)
  ], true), [
    n3,
    r3,
    i3
  ];
};
var ln = (e3, t3 = false) => {
  let [n3, r3, i3] = cn(e3, t3), a3 = n3 / W3, o3 = r3 / W3, s4 = i3 / W3, c4 = Math.max(a3, o3, s4), l3 = Math.min(a3, o3, s4), u4 = c4 - l3, d5 = (c4 + l3) * $e2 * U3, f4, p2;
  if (Math.round(d5) === 0 || Math.round(d5) === U3) f4 = 0, p2 = 0;
  else if (p2 = u4 / (1 - Math.abs(c4 + l3 - 1)) * U3, p2 === 0) f4 = 0;
  else {
    switch (c4) {
      case a3:
        f4 = (o3 - s4) / u4;
        break;
      case o3:
        f4 = (s4 - a3) / u4 + et;
        break;
      case s4:
      default:
        f4 = (a3 - o3) / u4 + tt;
    }
    f4 = f4 * at % st, f4 < 0 && (f4 += st);
  }
  return [
    f4,
    p2,
    d5
  ];
};
var un = (e3, t3 = false) => {
  let [n3, r3, i3] = cn(e3, t3), a3 = Math.min(n3, r3, i3) / W3, o3 = 1 - Math.max(n3, r3, i3) / W3, s4;
  return a3 + o3 === 1 ? s4 = 0 : [s4] = ln(e3), [
    s4,
    a3 * U3,
    o3 * U3
  ];
};
var dn = (e3, t3 = false) => {
  t3 || (e3 = Qt(e3, {
    maxLength: V2,
    validateRange: false
  }));
  let [n3, r3, i3] = J2(Et, J2(Ct, e3, true).map((e4) => Math.cbrt(e4)), true);
  n3 = Math.min(Math.max(n3, 0), 1);
  let a3 = Math.round(parseFloat(n3.toFixed(tt)) * U3);
  return (a3 === 0 || a3 === U3) && (r3 = 0, i3 = 0), [
    n3,
    r3,
    i3
  ];
};
var fn = (e3, t3 = false) => {
  let [n3, r3, i3] = dn(e3, t3), a3, o3, s4 = Math.round(parseFloat(n3.toFixed(tt)) * U3);
  return s4 === 0 || s4 === U3 ? (a3 = 0, o3 = 0) : (a3 = Math.max(Math.sqrt(r3 ** +ct + i3 ** +ct), 0), parseFloat(a3.toFixed(tt)) === 0 ? o3 = 0 : (o3 = Math.atan2(i3, r3) * ot / Math.PI, o3 < 0 && (o3 += st))), [
    n3,
    a3,
    o3
  ];
};
var pn = (e3, t3 = false) => (t3 || (e3 = Qt(e3, {
  maxLength: V2,
  validateRange: false
})), cn(J2(yt, e3, true), true));
var mn = (e3, t3 = false) => {
  t3 || (e3 = Qt(e3, {
    maxLength: V2,
    validateRange: false
  }));
  let [n3, r3, i3] = e3.map((e4, t4) => e4 / vt[t4]).map((e4) => e4 > gt ? Math.cbrt(e4) : (e4 * _t + H3) / pt), a3 = Math.min(Math.max(pt * r3 - H3, 0), U3), o3, s4;
  return a3 === 0 || a3 === U3 ? (o3 = 0, s4 = 0) : (o3 = (n3 - r3) * mt, s4 = (r3 - i3) * ht), [
    a3,
    o3,
    s4
  ];
};
var hn = (e3, t3 = false) => {
  let [n3, r3, i3] = mn(e3, t3), a3, o3;
  return n3 === 0 || n3 === U3 ? (a3 = 0, o3 = 0) : (a3 = Math.max(Math.sqrt(r3 ** +ct + i3 ** +ct), 0), o3 = Math.atan2(i3, r3) * ot / Math.PI, o3 < 0 && (o3 += st)), [
    n3,
    a3,
    o3
  ];
};
var gn = (e3) => {
  let [t3, n3, r3, i3] = Qt(e3, {
    alpha: true,
    maxRange: W3
  }), a3 = en(t3), o3 = en(n3), s4 = en(r3), c4 = en(i3 * W3), l3;
  return l3 = c4 === "ff" ? `#${a3}${o3}${s4}` : `#${a3}${o3}${s4}${c4}`, l3;
};
var _n = (e3) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  if (!(/^#[\da-f]{6}$/.test(e3) || /^#[\da-f]{3}$/.test(e3) || /^#[\da-f]{8}$/.test(e3) || /^#[\da-f]{4}$/.test(e3))) throw SyntaxError(`Invalid property value: ${e3}`);
  let t3 = [];
  if (/^#[\da-f]{3}$/.test(e3)) {
    let [, n3, r3, i3] = e3.match(/^#([\da-f])([\da-f])([\da-f])$/);
    t3.push(parseInt(`${n3}${n3}`, H3), parseInt(`${r3}${r3}`, H3), parseInt(`${i3}${i3}`, H3), 1);
  } else if (/^#[\da-f]{4}$/.test(e3)) {
    let [, n3, r3, i3, a3] = e3.match(/^#([\da-f])([\da-f])([\da-f])([\da-f])$/);
    t3.push(parseInt(`${n3}${n3}`, H3), parseInt(`${r3}${r3}`, H3), parseInt(`${i3}${i3}`, H3), rn(`${a3}${a3}`));
  } else if (/^#[\da-f]{8}$/.test(e3)) {
    let [, n3, r3, i3, a3] = e3.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})$/);
    t3.push(parseInt(n3, H3), parseInt(r3, H3), parseInt(i3, H3), rn(a3));
  } else {
    let [, n3, r3, i3] = e3.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/);
    t3.push(parseInt(n3, H3), parseInt(r3, H3), parseInt(i3, H3), 1);
  }
  return t3;
};
var vn = (e3) => {
  let [t3, n3, r3, i3] = _n(e3), [a3, o3, s4] = an([
    t3,
    n3,
    r3
  ], true);
  return [
    a3,
    o3,
    s4,
    i3
  ];
};
var yn = (e3) => {
  let [t3, n3, r3, i3] = vn(e3), [a3, o3, s4] = J2(xt, [
    t3,
    n3,
    r3
  ], true);
  return [
    a3,
    o3,
    s4,
    i3
  ];
};
var bn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Gt.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, i3] = e3.match(Gt), [a3, o3, s4, c4 = ""] = i3.match(/[^\s,/]+/g), l3, u4, d5;
  a3 === "none" ? l3 = 0 : (l3 = a3.endsWith("%") ? parseFloat(a3) * W3 / U3 : parseFloat(a3), l3 = Math.min(Math.max(A(l3, nt), 0), W3)), o3 === "none" ? u4 = 0 : (u4 = o3.endsWith("%") ? parseFloat(o3) * W3 / U3 : parseFloat(o3), u4 = Math.min(Math.max(A(u4, nt), 0), W3)), s4 === "none" ? d5 = 0 : (d5 = s4.endsWith("%") ? parseFloat(s4) * W3 / U3 : parseFloat(s4), d5 = Math.min(Math.max(A(d5, nt), 0), W3));
  let f4 = nn(c4);
  return [
    "rgb",
    l3,
    u4,
    d5,
    n3 === "mixValue" && c4 === "none" ? L3 : f4
  ];
};
var xn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Ft.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, i3] = e3.match(Ft), [a3, o3, s4, c4 = ""] = i3.match(/[^\s,/]+/g), l3, u4, d5;
  l3 = a3 === "none" ? 0 : tn(a3), u4 = o3 === "none" ? 0 : Math.min(Math.max(parseFloat(o3), 0), U3), d5 = s4 === "none" ? 0 : Math.min(Math.max(parseFloat(s4), 0), U3);
  let f4 = nn(c4);
  if (n3 === "hsl") return [
    n3,
    a3 === "none" ? a3 : l3,
    o3 === "none" ? o3 : u4,
    s4 === "none" ? s4 : d5,
    c4 === "none" ? c4 : f4
  ];
  l3 = l3 / st * it, d5 /= U3;
  let p2 = u4 / U3 * Math.min(d5, 1 - d5), h3 = l3 % it, g3 = (8 + l3) % it, _4 = (4 + l3) % it, v2 = d5 - p2 * Math.max(-1, Math.min(h3 - V2, V2 ** ct - h3, 1)), y2 = d5 - p2 * Math.max(-1, Math.min(g3 - V2, V2 ** ct - g3, 1)), b3 = d5 - p2 * Math.max(-1, Math.min(_4 - V2, V2 ** ct - _4, 1));
  return [
    "rgb",
    Math.min(Math.max(A(v2 * W3, nt), 0), W3),
    Math.min(Math.max(A(y2 * W3, nt), 0), W3),
    Math.min(Math.max(A(b3 * W3, nt), 0), W3),
    f4
  ];
};
var Sn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!It.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, i3] = e3.match(It), [a3, o3, s4, c4 = ""] = i3.match(/[^\s,/]+/g), l3, u4, d5;
  l3 = a3 === "none" ? 0 : tn(a3), u4 = o3 === "none" ? 0 : Math.min(Math.max(parseFloat(o3), 0), U3) / U3, d5 = s4 === "none" ? 0 : Math.min(Math.max(parseFloat(s4), 0), U3) / U3;
  let f4 = nn(c4);
  if (n3 === "hwb") return [
    n3,
    a3 === "none" ? a3 : l3,
    o3 === "none" ? o3 : u4 * U3,
    s4 === "none" ? s4 : d5 * U3,
    c4 === "none" ? c4 : f4
  ];
  if (u4 + d5 >= 1) {
    let e4 = A(u4 / (u4 + d5) * W3, nt);
    return [
      "rgb",
      e4,
      e4,
      e4,
      f4
    ];
  }
  let p2 = (1 - u4 - d5) / W3, [, h3, g3, _4] = xn(`hsl(${l3} 100 50)`);
  return h3 = A((h3 * p2 + u4) * W3, nt), g3 = A((g3 * p2 + u4) * W3, nt), _4 = A((_4 * p2 + u4) * W3, nt), [
    "rgb",
    Math.min(Math.max(h3, 0), W3),
    Math.min(Math.max(g3, 0), W3),
    Math.min(Math.max(_4, 0), W3),
    f4
  ];
};
var Cn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Lt.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let i3 = 1.25, [, a3] = e3.match(Lt), [o3, s4, c4, l3 = ""] = a3.match(/[^\s,/]+/g), u4, d5, f4;
  o3 === "none" ? u4 = 0 : (o3.endsWith("%") ? (u4 = parseFloat(o3), u4 > U3 && (u4 = U3)) : u4 = parseFloat(o3), u4 < 0 && (u4 = 0)), d5 = s4 === "none" ? 0 : s4.endsWith("%") ? parseFloat(s4) * i3 : parseFloat(s4), f4 = c4 === "none" ? 0 : c4.endsWith("%") ? parseFloat(c4) * i3 : parseFloat(c4);
  let p2 = nn(l3);
  if (K2.test(n3)) return [
    "lab",
    o3 === "none" ? o3 : A(u4, H3),
    s4 === "none" ? s4 : A(d5, H3),
    c4 === "none" ? c4 : A(f4, H3),
    l3 === "none" ? l3 : p2
  ];
  let h3 = (u4 + H3) / pt, g3 = d5 / mt + h3, _4 = h3 - f4 / ht, v2 = h3 ** +lt, y2 = g3 ** +lt, b3 = _4 ** +lt, [x4, S3, C3] = [
    y2 > gt ? y2 : (g3 * pt - H3) / _t,
    u4 > 8 ? v2 : u4 / _t,
    b3 > gt ? b3 : (_4 * pt - H3) / _t
  ].map((e4, t4) => e4 * vt[t4]);
  return [
    "xyz-d50",
    A(x4, H3),
    A(S3, H3),
    A(C3, H3),
    p2
  ];
};
var wn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Rt.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, i3] = e3.match(Rt), [a3, o3, s4, c4 = ""] = i3.match(/[^\s,/]+/g), l3, u4, d5;
  a3 === "none" ? l3 = 0 : (l3 = parseFloat(a3), l3 < 0 && (l3 = 0)), u4 = o3 === "none" ? 0 : o3.endsWith("%") ? parseFloat(o3) * 1.5 : parseFloat(o3), d5 = s4 === "none" ? 0 : tn(s4);
  let f4 = nn(c4);
  if (K2.test(n3)) return [
    "lch",
    a3 === "none" ? a3 : A(l3, H3),
    o3 === "none" ? o3 : A(u4, H3),
    s4 === "none" ? s4 : A(d5, H3),
    c4 === "none" ? c4 : f4
  ];
  let p2 = u4 * Math.cos(d5 * Math.PI / ot), h3 = u4 * Math.sin(d5 * Math.PI / ot), [, g3, _4, v2] = Cn(`lab(${l3} ${p2} ${h3})`);
  return [
    "xyz-d50",
    A(g3, H3),
    A(_4, H3),
    A(v2, H3),
    f4
  ];
};
var Tn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Ht.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let i3 = 0.4, [, a3] = e3.match(Ht), [o3, s4, c4, l3 = ""] = a3.match(/[^\s,/]+/g), u4, d5, f4;
  o3 === "none" ? u4 = 0 : (u4 = o3.endsWith("%") ? parseFloat(o3) / U3 : parseFloat(o3), u4 < 0 && (u4 = 0)), d5 = s4 === "none" ? 0 : s4.endsWith("%") ? parseFloat(s4) * i3 / U3 : parseFloat(s4), f4 = c4 === "none" ? 0 : c4.endsWith("%") ? parseFloat(c4) * i3 / U3 : parseFloat(c4);
  let p2 = nn(l3);
  if (K2.test(n3)) return [
    "oklab",
    o3 === "none" ? o3 : A(u4, H3),
    s4 === "none" ? s4 : A(d5, H3),
    c4 === "none" ? c4 : A(f4, H3),
    l3 === "none" ? l3 : p2
  ];
  let [h3, g3, _4] = J2(wt, J2(Tt, [
    u4,
    d5,
    f4
  ]).map((e4) => e4 ** +lt), true);
  return [
    "xyz-d65",
    A(h3, H3),
    A(g3, H3),
    A(_4, H3),
    p2
  ];
};
var En = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "", nullable: r3 = false } = t3;
  if (!Ut.test(e3)) {
    let e4 = Zt(n3, r3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, i3] = e3.match(Ut), [a3, o3, s4, c4 = ""] = i3.match(/[^\s,/]+/g), l3, u4, d5;
  a3 === "none" ? l3 = 0 : (l3 = a3.endsWith("%") ? parseFloat(a3) / U3 : parseFloat(a3), l3 < 0 && (l3 = 0)), o3 === "none" ? u4 = 0 : (u4 = o3.endsWith("%") ? parseFloat(o3) * 0.4 / U3 : parseFloat(o3), u4 < 0 && (u4 = 0)), d5 = s4 === "none" ? 0 : tn(s4);
  let f4 = nn(c4);
  if (K2.test(n3)) return [
    "oklch",
    a3 === "none" ? a3 : A(l3, H3),
    o3 === "none" ? o3 : A(u4, H3),
    s4 === "none" ? s4 : A(d5, H3),
    c4 === "none" ? c4 : f4
  ];
  let p2 = u4 * Math.cos(d5 * Math.PI / ot), h3 = u4 * Math.sin(d5 * Math.PI / ot), [g3, _4, v2] = J2(wt, J2(Tt, [
    l3,
    p2,
    h3
  ]).map((e4) => e4 ** +lt), true);
  return [
    "xyz-d65",
    A(g3, H3),
    A(_4, H3),
    A(v2, H3),
    f4
  ];
};
var Y3 = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { colorSpace: n3 = "", d50: r3 = false, format: i3 = "", nullable: a3 = false } = t3;
  if (!Pt.test(e3)) {
    let e4 = Zt(i3, a3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let [, o3] = e3.match(Pt), [s4, c4, l3, u4, d5 = ""] = o3.match(/[^\s,/]+/g), f4, p2, h3;
  s4 === "xyz" && (s4 = "xyz-d65"), f4 = c4 === "none" ? 0 : c4.endsWith("%") ? parseFloat(c4) / U3 : parseFloat(c4), p2 = l3 === "none" ? 0 : l3.endsWith("%") ? parseFloat(l3) / U3 : parseFloat(l3), h3 = u4 === "none" ? 0 : u4.endsWith("%") ? parseFloat(u4) / U3 : parseFloat(u4);
  let g3 = nn(d5);
  if (K2.test(i3) || i3 === "mixValue" && s4 === n3) return [
    s4,
    c4 === "none" ? c4 : A(f4, rt),
    l3 === "none" ? l3 : A(p2, rt),
    u4 === "none" ? u4 : A(h3, rt),
    d5 === "none" ? d5 : g3
  ];
  let _4 = 0, v2 = 0, y2 = 0;
  if (s4 === "srgb-linear") [_4, v2, y2] = J2(xt, [
    f4,
    p2,
    h3
  ]), r3 && ([_4, v2, y2] = J2(bt, [
    _4,
    v2,
    y2
  ], true));
  else if (s4 === "display-p3") {
    let e4 = an([
      f4 * W3,
      p2 * W3,
      h3 * W3
    ]);
    [_4, v2, y2] = J2(Dt, e4), r3 && ([_4, v2, y2] = J2(bt, [
      _4,
      v2,
      y2
    ], true));
  } else if (s4 === "rec2020") {
    let e4 = 1.09929682680944, t4 = 0.45, n4 = [
      f4,
      p2,
      h3
    ].map((n5) => {
      let r4;
      return r4 = n5 < 0.018053968510807 * t4 * rt ? n5 / (t4 * rt) : ((n5 + e4 - 1) / e4) ** (1 / t4), r4;
    });
    [_4, v2, y2] = J2(Ot, n4), r3 && ([_4, v2, y2] = J2(bt, [
      _4,
      v2,
      y2
    ], true));
  } else if (s4 === "a98-rgb") {
    let e4 = [
      f4,
      p2,
      h3
    ].map((e5) => e5 ** 2.19921875);
    [_4, v2, y2] = J2(kt, e4), r3 && ([_4, v2, y2] = J2(bt, [
      _4,
      v2,
      y2
    ], true));
  } else if (s4 === "prophoto-rgb") {
    let e4 = [
      f4,
      p2,
      h3
    ].map((e5) => {
      let t4;
      return t4 = e5 > 1 / 32 ? e5 ** 1.8 : e5 / H3, t4;
    });
    [_4, v2, y2] = J2(At, e4), r3 || ([_4, v2, y2] = J2(yt, [
      _4,
      v2,
      y2
    ], true));
  } else /^xyz(?:-d(?:50|65))?$/.test(s4) ? ([_4, v2, y2] = [
    f4,
    p2,
    h3
  ], s4 === "xyz-d50" ? r3 || ([_4, v2, y2] = J2(yt, [
    _4,
    v2,
    y2
  ])) : r3 && ([_4, v2, y2] = J2(bt, [
    _4,
    v2,
    y2
  ], true))) : ([_4, v2, y2] = on([
    f4 * W3,
    p2 * W3,
    h3 * W3
  ]), r3 && ([_4, v2, y2] = J2(bt, [
    _4,
    v2,
    y2
  ], true)));
  return [
    r3 ? "xyz-d50" : "xyz-d65",
    A(_4, H3),
    A(v2, H3),
    A(y2, H3),
    i3 === "mixValue" && d5 === "none" ? d5 : g3
  ];
};
var X2 = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  let { d50: n3 = false, format: r3 = "", nullable: i3 = false } = t3;
  if (!jt.test(e3)) {
    let e4 = Zt(r3, i3);
    return e4 === null ? null : (m2(e4), e4);
  }
  let a3 = 0, o3 = 0, s4 = 0, c4 = 0;
  if (G4.test(e3)) {
    if (r3 === "computedValue") return [
      "rgb",
      0,
      0,
      0,
      0
    ];
    if (r3 === "specifiedValue") return e3;
  } else if (/^[a-z]+$/.test(e3)) {
    if (Object.hasOwn(Xt, e3)) {
      if (r3 === "specifiedValue") return e3;
      let [t4, i4, l3] = Xt[e3];
      if (c4 = 1, r3 === "computedValue") return [
        "rgb",
        t4,
        i4,
        l3,
        c4
      ];
      [a3, o3, s4] = on([
        t4,
        i4,
        l3
      ], true), n3 && ([a3, o3, s4] = J2(bt, [
        a3,
        o3,
        s4
      ], true));
    } else switch (r3) {
      case z2:
        return i3 && e3 !== "transparent" ? null : [
          "rgb",
          0,
          0,
          0,
          0
        ];
      case Xe:
        return e3 === "transparent" ? e3 : "";
      case B:
        return e3 === "transparent" ? [
          "rgb",
          0,
          0,
          0,
          0
        ] : null;
    }
  } else if (e3[0] === "#") {
    if (K2.test(r3)) return ["rgb", ..._n(e3)];
    [a3, o3, s4, c4] = yn(e3), n3 && ([a3, o3, s4] = J2(bt, [
      a3,
      o3,
      s4
    ], true));
  } else if (e3.startsWith("lab")) {
    if (K2.test(r3)) return Cn(e3, t3);
    [, a3, o3, s4, c4] = Cn(e3), n3 || ([a3, o3, s4] = J2(yt, [
      a3,
      o3,
      s4
    ], true));
  } else if (e3.startsWith("lch")) {
    if (K2.test(r3)) return wn(e3, t3);
    [, a3, o3, s4, c4] = wn(e3), n3 || ([a3, o3, s4] = J2(yt, [
      a3,
      o3,
      s4
    ], true));
  } else if (e3.startsWith("oklab")) {
    if (K2.test(r3)) return Tn(e3, t3);
    [, a3, o3, s4, c4] = Tn(e3), n3 && ([a3, o3, s4] = J2(bt, [
      a3,
      o3,
      s4
    ], true));
  } else if (e3.startsWith("oklch")) {
    if (K2.test(r3)) return En(e3, t3);
    [, a3, o3, s4, c4] = En(e3), n3 && ([a3, o3, s4] = J2(bt, [
      a3,
      o3,
      s4
    ], true));
  } else {
    let i4, l3, u4;
    if (e3.startsWith("hsl") ? [, i4, l3, u4, c4] = xn(e3) : e3.startsWith("hwb") ? [, i4, l3, u4, c4] = Sn(e3) : [, i4, l3, u4, c4] = bn(e3, t3), K2.test(r3)) return [
      "rgb",
      Math.round(i4),
      Math.round(l3),
      Math.round(u4),
      c4
    ];
    [a3, o3, s4] = on([
      i4,
      l3,
      u4
    ]), n3 && ([a3, o3, s4] = J2(bt, [
      a3,
      o3,
      s4
    ], true));
  }
  return [
    n3 ? "xyz-d50" : "xyz-d65",
    A(a3, H3),
    A(o3, H3),
    A(s4, H3),
    c4
  ];
};
var Dn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  let { colorSpace: n3 = "", format: r3 = "", nullable: i3 = false } = t3, a3 = p({
    namespace: Ze2,
    name: "resolveColorValue",
    value: e3
  }, t3), o3 = d4(a3);
  if (o3 !== false) return o3.item;
  if (!jt.test(e3)) {
    let e4 = Zt(r3, i3);
    return e4 === null ? (u3(a3, null), null) : (u3(a3, e4), m2(e4), e4);
  }
  let s4 = "", c4 = 0, l3 = 0, f4 = 0, h3 = 0;
  if (G4.test(e3)) {
    if (r3 === "specifiedValue") return u3(a3, e3), e3;
  } else if (/^[a-z]+$/.test(e3)) {
    if (Object.hasOwn(Xt, e3)) {
      if (r3 === "specifiedValue") return u3(a3, e3), e3;
      [c4, l3, f4] = Xt[e3], h3 = 1;
    } else switch (r3) {
      case Xe:
        return e3 === "transparent" ? (u3(a3, e3), e3) : (u3(a3, ""), "");
      case B:
        if (e3 === "transparent") {
          let e4 = [
            "rgb",
            0,
            0,
            0,
            0
          ];
          return u3(a3, e4), e4;
        }
        return u3(a3, null), null;
      case z2:
      default: {
        if (i3 && e3 !== "transparent") return u3(a3, null), null;
        let t4 = [
          "rgb",
          0,
          0,
          0,
          0
        ];
        return u3(a3, t4), t4;
      }
    }
  } else if (e3[0] === "#") [c4, l3, f4, h3] = _n(e3);
  else if (e3.startsWith("hsl")) [, c4, l3, f4, h3] = xn(e3, t3);
  else if (e3.startsWith("hwb")) [, c4, l3, f4, h3] = Sn(e3, t3);
  else if (/^l(?:ab|ch)/.test(e3)) {
    let n4, i4, o4;
    if (e3.startsWith("lab") ? [s4, n4, i4, o4, h3] = Cn(e3, t3) : [s4, n4, i4, o4, h3] = wn(e3, t3), K2.test(r3)) {
      let e4 = [
        s4,
        n4,
        i4,
        o4,
        h3
      ];
      return u3(a3, e4), e4;
    }
    [c4, l3, f4] = pn([
      n4,
      i4,
      o4
    ]);
  } else if (/^okl(?:ab|ch)/.test(e3)) {
    let n4, i4, o4;
    if (e3.startsWith("oklab") ? [s4, n4, i4, o4, h3] = Tn(e3, t3) : [s4, n4, i4, o4, h3] = En(e3, t3), K2.test(r3)) {
      let e4 = [
        s4,
        n4,
        i4,
        o4,
        h3
      ];
      return u3(a3, e4), e4;
    }
    [c4, l3, f4] = cn([
      n4,
      i4,
      o4
    ]);
  } else [, c4, l3, f4, h3] = bn(e3, t3);
  if (r3 === "mixValue" && n3 === "srgb") {
    let e4 = [
      "srgb",
      c4 / W3,
      l3 / W3,
      f4 / W3,
      h3
    ];
    return u3(a3, e4), e4;
  }
  let g3 = [
    "rgb",
    Math.round(c4),
    Math.round(l3),
    Math.round(f4),
    h3
  ];
  return u3(a3, g3), g3;
};
var On = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  let { colorSpace: n3 = "", format: r3 = "", nullable: i3 = false } = t3, a3 = p({
    namespace: Ze2,
    name: "resolveColorFunc",
    value: e3
  }, t3), o3 = d4(a3);
  if (o3 !== false) return o3.item;
  if (!Pt.test(e3)) {
    let e4 = Zt(r3, i3);
    return e4 === null ? (u3(a3, null), null) : (u3(a3, e4), m2(e4), e4);
  }
  let [s4, c4, l3, f4, h3] = Y3(e3, t3);
  if (K2.test(r3) || r3 === "mixValue" && s4 === n3) {
    let e4 = [
      s4,
      c4,
      l3,
      f4,
      h3
    ];
    return u3(a3, e4), e4;
  }
  let g3 = parseFloat(`${c4}`), _4 = parseFloat(`${l3}`), v2 = parseFloat(`${f4}`), y2 = nn(`${h3}`), [b3, x4, S3] = cn([
    g3,
    _4,
    v2
  ], true), C3 = [
    "rgb",
    b3,
    x4,
    S3,
    y2
  ];
  return u3(a3, C3), C3;
};
var kn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { colorSpace: n3 = "", format: r3 = "" } = t3, i3 = "", a3, o3, s4, c4, l3, u4, d5;
  if (r3 === "mixValue") {
    let r4;
    if (r4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), r4 === null) return null;
    if ([i3, l3, u4, d5, c4] = r4, i3 === n3) return [
      l3,
      u4,
      d5,
      c4
    ];
    [a3, o3, s4] = J2(St, [
      l3,
      u4,
      d5
    ], true);
  } else if (e3.startsWith("color(")) {
    let [, t4] = e3.match(Pt), [n4] = t4.match(/[^\s,/]+/g);
    n4 === "srgb-linear" ? [, a3, o3, s4, c4] = On(e3, { format: z2 }) : ([, l3, u4, d5, c4] = Y3(e3), [a3, o3, s4] = J2(St, [
      l3,
      u4,
      d5
    ], true));
  } else [, l3, u4, d5, c4] = X2(e3), [a3, o3, s4] = J2(St, [
    l3,
    u4,
    d5
  ], true);
  return [
    Math.min(Math.max(a3, 0), 1),
    Math.min(Math.max(o3, 0), 1),
    Math.min(Math.max(s4, 0), 1),
    c4
  ];
};
var An = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (n3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? On(e3, t3) : Dn(e3, t3), n4 === null) return null;
    [, r3, i3, a3, o3] = n4;
  } else if (e3.startsWith("color(")) {
    let [, t4] = e3.match(Pt), [n4] = t4.match(/[^\s,/]+/g);
    n4 === "srgb" ? ([, r3, i3, a3, o3] = On(e3, { format: z2 }), r3 *= W3, i3 *= W3, a3 *= W3) : [, r3, i3, a3, o3] = On(e3);
  } else /^(?:ok)?l(?:ab|ch)/.test(e3) ? ([r3, i3, a3, o3] = kn(e3), [r3, i3, a3] = sn([
    r3,
    i3,
    a3
  ])) : [, r3, i3, a3, o3] = Dn(e3, { format: z2 });
  return [
    r3,
    i3,
    a3,
    o3
  ];
};
var jn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { d50: n3 = false, format: r3 = "" } = t3, i3, a3, o3, s4;
  if (r3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, i3, a3, o3, s4] = n4;
  } else if (e3.startsWith("color(")) {
    let [, r4] = e3.match(Pt), [c4] = r4.match(/[^\s,/]+/g);
    n3 ? c4 === "xyz-d50" ? [, i3, a3, o3, s4] = On(e3, { format: z2 }) : [, i3, a3, o3, s4] = Y3(e3, t3) : /^xyz(?:-d65)?$/.test(c4) ? [, i3, a3, o3, s4] = On(e3, { format: z2 }) : [, i3, a3, o3, s4] = Y3(e3);
  } else [, i3, a3, o3, s4] = X2(e3, t3);
  return [
    i3,
    a3,
    o3,
    s4
  ];
};
var Mn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (Ft.test(e3)) return [, r3, i3, a3, o3] = xn(e3, { format: "hsl" }), n3 === "hsl" ? [
    Math.round(r3),
    Math.round(i3),
    Math.round(a3),
    o3
  ] : [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3) : [, s4, c4, l3, o3] = X2(e3);
  return [r3, i3, a3] = ln([
    s4,
    c4,
    l3
  ], true), n3 === "hsl" ? [
    Math.round(r3),
    Math.round(i3),
    Math.round(a3),
    o3
  ] : [
    n3 === "mixValue" && i3 === 0 ? L3 : r3,
    i3,
    a3,
    o3
  ];
};
var Nn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (It.test(e3)) return [, r3, i3, a3, o3] = Sn(e3, { format: "hwb" }), n3 === "hwb" ? [
    Math.round(r3),
    Math.round(i3),
    Math.round(a3),
    o3
  ] : [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3) : [, s4, c4, l3, o3] = X2(e3);
  return [r3, i3, a3] = un([
    s4,
    c4,
    l3
  ], true), n3 === "hwb" ? [
    Math.round(r3),
    Math.round(i3),
    Math.round(a3),
    o3
  ] : [
    n3 === "mixValue" && i3 + a3 >= 100 ? L3 : r3,
    i3,
    a3,
    o3
  ];
};
var Pn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (Lt.test(e3)) return [, r3, i3, a3, o3] = Cn(e3, { format: z2 }), [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (t3.d50 = true, n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3, { d50: true }) : [, s4, c4, l3, o3] = X2(e3, { d50: true });
  return [r3, i3, a3] = mn([
    s4,
    c4,
    l3
  ], true), [
    r3,
    i3,
    a3,
    o3
  ];
};
var Fn = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (Rt.test(e3)) return [, r3, i3, a3, o3] = wn(e3, { format: z2 }), [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (t3.d50 = true, n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3, { d50: true }) : [, s4, c4, l3, o3] = X2(e3, { d50: true });
  return [r3, i3, a3] = hn([
    s4,
    c4,
    l3
  ], true), [
    r3,
    i3,
    n3 === "mixValue" && i3 === 0 ? L3 : a3,
    o3
  ];
};
var In = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (Ht.test(e3)) return [, r3, i3, a3, o3] = Tn(e3, { format: z2 }), [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3) : [, s4, c4, l3, o3] = X2(e3);
  return [r3, i3, a3] = dn([
    s4,
    c4,
    l3
  ], true), [
    r3,
    i3,
    a3,
    o3
  ];
};
var Ln = (e3, t3 = {}) => {
  if (m2(e3)) e3 = e3.trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: n3 = "" } = t3, r3, i3, a3, o3;
  if (Ut.test(e3)) return [, r3, i3, a3, o3] = En(e3, { format: z2 }), [
    r3,
    i3,
    a3,
    o3
  ];
  let s4, c4, l3;
  if (n3 === "mixValue") {
    let n4;
    if (n4 = e3.startsWith("color(") ? Y3(e3, t3) : X2(e3, t3), n4 === null) return null;
    [, s4, c4, l3, o3] = n4;
  } else e3.startsWith("color(") ? [, s4, c4, l3, o3] = Y3(e3) : [, s4, c4, l3, o3] = X2(e3);
  return [r3, i3, a3] = fn([
    s4,
    c4,
    l3
  ], true), [
    r3,
    i3,
    n3 === "mixValue" && i3 === 0 ? L3 : a3,
    o3
  ];
};
var Rn = (e3, t3 = {}, n3 = () => null) => {
  if (m2(e3)) e3 = e3.toLowerCase().trim();
  else throw TypeError(`${e3} is not a string.`);
  let { format: r3 = "", nullable: i3 = false } = t3, a3 = p({
    namespace: Ze2,
    name: "resolveColorMix",
    value: e3
  }, t3), o3 = d4(a3);
  if (o3 !== false) return o3.item;
  let s4 = [], c4 = "", l3 = "", f4 = "", h3 = "", g3 = "", _4 = "", v2 = false;
  if (!zt.test(e3)) {
    if (e3.startsWith("color-mix(") && Vt.test(e3)) {
      let t4 = e3.match(Vt);
      for (let i4 of t4) if (i4) {
        let t5 = Rn(i4, { format: r3 === "specifiedValue" ? r3 : z2 }, n3);
        if (Array.isArray(t5)) {
          let [n4, r4, i5, a4, o4] = t5;
          if (r4 === 0 && i5 === 0 && a4 === 0 && o4 === 0) {
            e3 = "";
            break;
          }
          t5 = Kt.test(n4) ? o4 === 1 ? `color(${n4} ${r4} ${i5} ${a4})` : `color(${n4} ${r4} ${i5} ${a4} / ${o4})` : o4 === 1 ? `${n4}(${r4} ${i5} ${a4})` : `${n4}(${r4} ${i5} ${a4} / ${o4})`;
        } else if (!zt.test(t5)) {
          e3 = "";
          break;
        }
        s4.push(t5), e3 = e3.replace(i4, t5);
      }
      if (!e3) return q2(a3, r3, i3);
    } else if (e3.startsWith("color-mix(") && e3.endsWith(")") && e3.includes("light-dark(")) {
      let [o4 = "", s5 = "", u4 = ""] = k3(e3.replace(Pe2, "").replace(/\)$/, ""), { delimiter: "," }), [d5 = "", p2 = ""] = k3(s5), [y3 = "", b4 = ""] = k3(u4), x5 = n3(d5, { format: Xe }), S4 = n3(y3, { format: Xe });
      if (qt.test(o4) && x5 && S4) {
        if (r3 === "specifiedValue") {
          let [, t4] = o4.match(qt);
          Mt.test(t4) ? [, c4, l3] = t4.match(Mt) : c4 = t4, f4 = x5, p2 && (h3 = p2), g3 = S4, b4 && (_4 = b4), e3 = e3.replace(d5, x5).replace(y3, S4), v2 = true;
        } else {
          let r4 = n3(d5, t3), i4 = n3(y3, t3);
          m2(r4) && m2(i4) && (e3 = e3.replace(d5, r4).replace(y3, i4));
        }
      } else return q2(a3, r3, i3);
    } else return q2(a3, r3, i3);
  }
  if (s4.length && r3 === "specifiedValue") {
    let [, t4] = e3.match(Jt);
    if (Mt.test(t4) ? [, c4, l3] = t4.match(Mt) : c4 = t4, s4.length === 2) {
      let [t5, n4] = s4;
      t5 = t5.replace(/(?=[()])/g, "\\"), n4 = n4.replace(/(?=[()])/g, "\\");
      let r4 = RegExp(`(${t5})(?:\\s+(${R3}))?`), i4 = RegExp(`(${n4})(?:\\s+(${R3}))?`);
      [, f4, h3] = e3.match(r4), [, g3, _4] = e3.match(i4);
    } else {
      let [t5] = s4;
      t5 = t5.replace(/(?=[()])/g, "\\");
      let n4 = `${t5}(?:\\s+${R3})?`, o4 = `(${t5})(?:\\s+(${R3}))?`, c5 = RegExp(`^${o4}$`);
      if (RegExp(`${o4}\\s*\\)$`).test(e3)) {
        let t6 = RegExp(`(${qe})\\s*,\\s*(${n4})\\s*\\)$`), o5 = e3.match(t6);
        if (!o5) return q2(a3, r3, i3);
        let [, s5, l4] = o5;
        [, f4, h3] = s5.match(Yt), [, g3, _4] = l4.match(c5);
      } else {
        let t6 = RegExp(`(${n4})\\s*,\\s*(${qe})\\s*\\)$`), o5 = e3.match(t6);
        if (!o5) return q2(a3, r3, i3);
        let [, s5, l4] = o5;
        [, f4, h3] = s5.match(c5), [, g3, _4] = l4.match(Yt);
      }
    }
  } else if (!v2) {
    let t4 = e3.match(Bt);
    if (!t4) return q2(a3, r3, i3);
    let [, n4, o4, s5] = t4;
    [, f4, h3] = o4.match(Yt), [, g3, _4] = s5.match(Yt), Mt.test(n4) ? [, c4, l3] = n4.match(Mt) : c4 = n4;
  }
  let y2, b3, x4;
  if (h3 && _4) {
    let e4 = parseFloat(h3) / U3, t4 = parseFloat(_4) / U3;
    if (e4 < 0 || e4 > 1 || t4 < 0 || t4 > 1 || e4 === 0 && t4 === 0) return q2(a3, r3, i3);
    let n4 = e4 + t4;
    y2 = e4 / n4, b3 = t4 / n4, x4 = n4 < 1 ? n4 : 1;
  } else {
    if (h3) {
      if (y2 = parseFloat(h3) / U3, y2 < 0 || y2 > 1) return q2(a3, r3, i3);
      b3 = 1 - y2;
    } else if (_4) {
      if (b3 = parseFloat(_4) / U3, b3 < 0 || b3 > 1) return q2(a3, r3, i3);
      y2 = 1 - b3;
    } else y2 = $e2, b3 = $e2;
    x4 = 1;
  }
  if (c4 === "xyz" && (c4 = "xyz-d65"), r3 === "specifiedValue") {
    let e4 = "", n4 = "";
    if (f4.startsWith("color-mix(") || f4.startsWith("light-dark(")) e4 = f4;
    else if (f4.startsWith("color(")) {
      let [n5, r4, i4, a4, o4] = Y3(f4, t3);
      e4 = o4 === 1 ? `color(${n5} ${r4} ${i4} ${a4})` : `color(${n5} ${r4} ${i4} ${a4} / ${o4})`;
    } else {
      let n5 = X2(f4, t3);
      if (Array.isArray(n5)) {
        let [t4, r4, i4, a4, o4] = n5;
        e4 = o4 === 1 ? t4 === "rgb" ? `${t4}(${r4}, ${i4}, ${a4})` : `${t4}(${r4} ${i4} ${a4})` : t4 === "rgb" ? `${t4}a(${r4}, ${i4}, ${a4}, ${o4})` : `${t4}(${r4} ${i4} ${a4} / ${o4})`;
      } else {
        if (!m2(n5) || !n5) return u3(a3, ""), "";
        e4 = n5;
      }
    }
    if (g3.startsWith("color-mix(") || g3.startsWith("light-dark(")) n4 = g3;
    else if (g3.startsWith("color(")) {
      let [e5, r4, i4, a4, o4] = Y3(g3, t3);
      n4 = o4 === 1 ? `color(${e5} ${r4} ${i4} ${a4})` : `color(${e5} ${r4} ${i4} ${a4} / ${o4})`;
    } else {
      let e5 = X2(g3, t3);
      if (Array.isArray(e5)) {
        let [t4, r4, i4, a4, o4] = e5;
        n4 = o4 === 1 ? t4 === "rgb" ? `${t4}(${r4}, ${i4}, ${a4})` : `${t4}(${r4} ${i4} ${a4})` : t4 === "rgb" ? `${t4}a(${r4}, ${i4}, ${a4}, ${o4})` : `${t4}(${r4} ${i4} ${a4} / ${o4})`;
      } else {
        if (!m2(e5) || !e5) return u3(a3, ""), "";
        n4 = e5;
      }
    }
    if (h3 && _4) e4 += ` ${parseFloat(h3)}%`, n4 += ` ${parseFloat(_4)}%`;
    else if (h3) {
      let t4 = parseFloat(h3);
      t4 !== U3 * $e2 && (e4 += ` ${t4}%`);
    } else if (_4) {
      let t4 = U3 - parseFloat(_4);
      t4 !== U3 * $e2 && (e4 += ` ${t4}%`);
    }
    if (l3) {
      let t4 = `color-mix(in ${c4} ${l3} hue, ${e4}, ${n4})`;
      return u3(a3, t4), t4;
    }
    {
      let t4 = `color-mix(in ${c4}, ${e4}, ${n4})`;
      return u3(a3, t4), t4;
    }
  }
  let S3 = 0, C3 = 0, w2 = 0, T4 = 0;
  if (/^srgb(?:-linear)?$/.test(c4)) {
    let e4, t4;
    if (c4 === "srgb" ? (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : An(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : An(g3, {
      colorSpace: c4,
      format: B
    })) : (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : kn(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : kn(g3, {
      colorSpace: c4,
      format: B
    })), e4 === null || t4 === null) return q2(a3, r3, i3);
    let [n4, o4, s5, l4] = e4, [d5, p2, m3, h4] = t4, _5 = n4 === "none" && d5 === "none", v3 = o4 === "none" && p2 === "none", E3 = s5 === "none" && m3 === "none", D3 = l4 === "none" && h4 === "none", [[O4, ee2, te2, ne2], [re2, k4, ie2, ae2]] = $t([
      n4,
      o4,
      s5,
      l4
    ], [
      d5,
      p2,
      m3,
      h4
    ], true), j4 = ne2 * y2, M4 = ae2 * b3;
    if (T4 = j4 + M4, T4 === 0 ? (S3 = O4 * y2 + re2 * b3, C3 = ee2 * y2 + k4 * b3, w2 = te2 * y2 + ie2 * b3) : (S3 = (O4 * j4 + re2 * M4) / T4, C3 = (ee2 * j4 + k4 * M4) / T4, w2 = (te2 * j4 + ie2 * M4) / T4, T4 = parseFloat(T4.toFixed(3))), r3 === "computedValue") {
      let e5 = [
        c4,
        _5 ? L3 : A(S3, H3),
        v3 ? L3 : A(C3, H3),
        E3 ? L3 : A(w2, H3),
        D3 ? L3 : T4 * x4
      ];
      return u3(a3, e5), e5;
    }
    S3 *= W3, C3 *= W3, w2 *= W3;
  } else if (Nt.test(c4)) {
    let e4, t4;
    if (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : jn(f4, {
      colorSpace: c4,
      d50: c4 === "xyz-d50",
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : jn(g3, {
      colorSpace: c4,
      d50: c4 === "xyz-d50",
      format: B
    }), e4 === null || t4 === null) return q2(a3, r3, i3);
    let [n4, o4, s5, l4] = e4, [d5, p2, m3, h4] = t4, _5 = n4 === "none" && d5 === "none", v3 = o4 === "none" && p2 === "none", E3 = s5 === "none" && m3 === "none", D3 = l4 === "none" && h4 === "none", [[O4, ee2, te2, ne2], [re2, k4, ie2, ae2]] = $t([
      n4,
      o4,
      s5,
      l4
    ], [
      d5,
      p2,
      m3,
      h4
    ], true), j4 = ne2 * y2, M4 = ae2 * b3;
    T4 = j4 + M4;
    let N2, P4, F2;
    if (T4 === 0 ? (N2 = O4 * y2 + re2 * b3, P4 = ee2 * y2 + k4 * b3, F2 = te2 * y2 + ie2 * b3) : (N2 = (O4 * j4 + re2 * M4) / T4, P4 = (ee2 * j4 + k4 * M4) / T4, F2 = (te2 * j4 + ie2 * M4) / T4, T4 = parseFloat(T4.toFixed(3))), r3 === "computedValue") {
      let e5 = [
        c4,
        _5 ? L3 : A(N2, H3),
        v3 ? L3 : A(P4, H3),
        E3 ? L3 : A(F2, H3),
        D3 ? L3 : T4 * x4
      ];
      return u3(a3, e5), e5;
    }
    c4 === "xyz-d50" ? [S3, C3, w2] = pn([
      N2,
      P4,
      F2
    ], true) : [S3, C3, w2] = cn([
      N2,
      P4,
      F2
    ], true);
  } else if (/^h(?:sl|wb)$/.test(c4)) {
    let e4, t4;
    if (c4 === "hsl" ? (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : Mn(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : Mn(g3, {
      colorSpace: c4,
      format: B
    })) : (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : Nn(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : Nn(g3, {
      colorSpace: c4,
      format: B
    })), e4 === null || t4 === null) return q2(a3, r3, i3);
    let [n4, o4, s5, d5] = e4, [p2, m3, h4, _5] = t4, v3 = d5 === "none" && _5 === "none", [[E3, D3, O4, ee2], [te2, ne2, re2, k4]] = $t([
      n4,
      o4,
      s5,
      d5
    ], [
      p2,
      m3,
      h4,
      _5
    ], true);
    l3 && ([E3, te2] = ae(E3, te2, l3));
    let ie2 = ee2 * y2, j4 = k4 * b3;
    T4 = ie2 + j4;
    let M4 = (E3 * y2 + te2 * b3) % st, N2, P4;
    if (T4 === 0 ? (N2 = D3 * y2 + ne2 * b3, P4 = O4 * y2 + re2 * b3) : (N2 = (D3 * ie2 + ne2 * j4) / T4, P4 = (O4 * ie2 + re2 * j4) / T4, T4 = parseFloat(T4.toFixed(3))), [S3, C3, w2] = An(`${c4}(${M4} ${N2} ${P4})`), r3 === "computedValue") {
      let e5 = [
        "srgb",
        A(S3 / W3, H3),
        A(C3 / W3, H3),
        A(w2 / W3, H3),
        v3 ? L3 : T4 * x4
      ];
      return u3(a3, e5), e5;
    }
  } else if (/^(?:ok)?lch$/.test(c4)) {
    let e4, t4;
    if (c4 === "lch" ? (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : Fn(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : Fn(g3, {
      colorSpace: c4,
      format: B
    })) : (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : Ln(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : Ln(g3, {
      colorSpace: c4,
      format: B
    })), e4 === null || t4 === null) return q2(a3, r3, i3);
    let [n4, o4, s5, d5] = e4, [p2, m3, h4, _5] = t4, v3 = n4 === "none" && p2 === "none", E3 = o4 === "none" && m3 === "none", D3 = s5 === "none" && h4 === "none", O4 = d5 === "none" && _5 === "none", [[ee2, te2, ne2, re2], [k4, ie2, j4, M4]] = $t([
      n4,
      o4,
      s5,
      d5
    ], [
      p2,
      m3,
      h4,
      _5
    ], true);
    l3 && ([ne2, j4] = ae(ne2, j4, l3));
    let N2 = re2 * y2, P4 = M4 * b3;
    T4 = N2 + P4;
    let F2 = (ne2 * y2 + j4 * b3) % st, oe2, se2;
    if (T4 === 0 ? (oe2 = ee2 * y2 + k4 * b3, se2 = te2 * y2 + ie2 * b3) : (oe2 = (ee2 * N2 + k4 * P4) / T4, se2 = (te2 * N2 + ie2 * P4) / T4, T4 = parseFloat(T4.toFixed(3))), r3 === "computedValue") {
      let e5 = [
        c4,
        v3 ? L3 : A(oe2, H3),
        E3 ? L3 : A(se2, H3),
        D3 ? L3 : A(F2, H3),
        O4 ? L3 : T4 * x4
      ];
      return u3(a3, e5), e5;
    }
    [, S3, C3, w2] = Dn(`${c4}(${oe2} ${se2} ${F2})`);
  } else {
    let e4, t4;
    if (c4 === "lab" ? (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : Pn(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : Pn(g3, {
      colorSpace: c4,
      format: B
    })) : (e4 = G4.test(f4) ? [
      L3,
      L3,
      L3,
      L3
    ] : In(f4, {
      colorSpace: c4,
      format: B
    }), t4 = G4.test(g3) ? [
      L3,
      L3,
      L3,
      L3
    ] : In(g3, {
      colorSpace: c4,
      format: B
    })), e4 === null || t4 === null) return q2(a3, r3, i3);
    let [n4, o4, s5, l4] = e4, [d5, p2, m3, h4] = t4, _5 = n4 === "none" && d5 === "none", v3 = o4 === "none" && p2 === "none", E3 = s5 === "none" && m3 === "none", D3 = l4 === "none" && h4 === "none", [[O4, ee2, te2, ne2], [re2, k4, ie2, ae2]] = $t([
      n4,
      o4,
      s5,
      l4
    ], [
      d5,
      p2,
      m3,
      h4
    ], true), j4 = ne2 * y2, M4 = ae2 * b3;
    T4 = j4 + M4;
    let N2, P4, F2;
    if (T4 === 0 ? (N2 = O4 * y2 + re2 * b3, P4 = ee2 * y2 + k4 * b3, F2 = te2 * y2 + ie2 * b3) : (N2 = (O4 * j4 + re2 * M4) / T4, P4 = (ee2 * j4 + k4 * M4) / T4, F2 = (te2 * j4 + ie2 * M4) / T4, T4 = parseFloat(T4.toFixed(3))), r3 === "computedValue") {
      let e5 = [
        c4,
        _5 ? L3 : A(N2, H3),
        v3 ? L3 : A(P4, H3),
        E3 ? L3 : A(F2, H3),
        D3 ? L3 : T4 * x4
      ];
      return u3(a3, e5), e5;
    }
    [, S3, C3, w2] = Dn(`${c4}(${N2} ${P4} ${F2})`);
  }
  let E2 = [
    "rgb",
    Math.round(S3),
    Math.round(C3),
    Math.round(w2),
    parseFloat((T4 * x4).toFixed(3))
  ];
  return u3(a3, E2), E2;
};
var { CloseParen: zn, Comment: Bn, Delim: Vn, Dimension: Hn, EOF: Un, Function: Wn, Ident: Gn, Number: Kn, OpenParen: qn, Percentage: Jn, Whitespace: Yn } = u;
var { HasNoneKeywords: Xn } = De;
var Zn = "relative-color";
var Qn = 8;
var $n = 10;
var er = 16;
var tr = 100;
var nr = 255;
var rr = /* @__PURE__ */ new Map([
  ["color", [
    "r",
    "g",
    "b",
    "alpha"
  ]],
  ["hsl", [
    "h",
    "s",
    "l",
    "alpha"
  ]],
  ["hsla", [
    "h",
    "s",
    "l",
    "alpha"
  ]],
  ["hwb", [
    "h",
    "w",
    "b",
    "alpha"
  ]],
  ["lab", [
    "l",
    "a",
    "b",
    "alpha"
  ]],
  ["lch", [
    "l",
    "c",
    "h",
    "alpha"
  ]],
  ["oklab", [
    "l",
    "a",
    "b",
    "alpha"
  ]],
  ["oklch", [
    "l",
    "c",
    "h",
    "alpha"
  ]],
  ["rgb", [
    "r",
    "g",
    "b",
    "alpha"
  ]],
  ["rgba", [
    "r",
    "g",
    "b",
    "alpha"
  ]]
]);
var ir = RegExp(`^${Fe2}(${Ke}|${Je})\\s+`);
var ar = /(?:hsla?|hwb)$/;
var or = RegExp(`^(?:${Oe}|${ke})$`);
var sr = /^(?:abs|sig?n|cos|tan)\(/;
var cr = new RegExp(me);
var lr = new RegExp(Fe2);
var ur = RegExp(`^${Ie}`);
var dr = RegExp(`^${Fe2}`);
var fr = new RegExp(he);
function pr(e3, t3 = {}) {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  let { colorSpace: n3 = "", format: r3 = "" } = t3, i3 = rr.get(n3);
  if (!i3) return null;
  let a3 = /* @__PURE__ */ new Set(), o3 = [
    [],
    [],
    [],
    []
  ], s4 = 0, c4 = 0, l3 = "", u4 = false;
  for (let n4 of e3) {
    if (!Array.isArray(n4)) throw TypeError(`${n4} is not an array.`);
    let [e4, r4, , , d6] = n4, f4 = o3[s4];
    if (Array.isArray(f4)) switch (e4) {
      case Vn:
        if (l3) {
          if ((r4 === "+" || r4 === "-") && u4 && !sr.test(l3)) return null;
          u4 = false, f4.push(r4);
        }
        break;
      case Hn: {
        if (!l3 || !sr.test(l3)) return null;
        let e5 = ei(n4, t3);
        m2(e5) ? f4.push(e5) : f4.push(r4);
        break;
      }
      case Wn:
        f4.push(r4), l3 = r4, c4++, cr.test(r4) && a3.add(c4);
        break;
      case Gn:
        if (!i3.includes(r4)) return null;
        f4.push(r4), l3 || s4++;
        break;
      case Kn:
        f4.push(Number(d6?.value)), l3 || s4++;
        break;
      case qn:
        f4.push(r4), c4++;
        break;
      case zn:
        l3 && (f4.at(-1) === " " ? f4[f4.length - 1] = r4 : f4.push(r4), a3.has(c4) && a3.delete(c4), c4--, c4 === 0 && (l3 = "", s4++));
        break;
      case Jn:
        if (!l3) return null;
        if (!sr.test(l3)) {
          let e5;
          for (let t4 = f4.length - 1; t4 >= 0; t4--) if (f4[t4] !== " ") {
            e5 = f4[t4];
            break;
          }
          if (e5 === "+" || e5 === "-") return null;
          u4 = e5 !== "*" && e5 !== "/";
        }
        f4.push(Number(d6?.value) / tr);
        break;
      case Yn:
        if (f4.length && l3) {
          let e5 = f4.at(-1);
          (typeof e5 == "number" || m2(e5) && !e5.endsWith("(") && e5 !== " ") && f4.push(r4);
        }
        break;
      default:
        e4 !== Bn && e4 !== Un && l3 && f4.push(r4);
    }
  }
  let d5 = [];
  for (let e4 of o3) if (e4.length === 1) {
    let [t4] = e4;
    h2(t4) && d5.push(t4);
  } else if (e4.length) {
    let t4 = $r(e4.join(""), { format: r3 });
    d5.push(t4);
  }
  return d5;
}
function mr(e3, t3 = {}, r3 = () => null) {
  let { colorScheme: i3 = "normal", currentColor: a3 = "", format: o3 = "" } = t3;
  if (m2(e3)) {
    if (e3 = e3.toLowerCase().trim(), !e3) return null;
    if (!dr.test(e3)) return e3;
  } else return null;
  let s4 = p({
    namespace: Zn,
    name: "extractOriginColor",
    value: e3
  }, t3), c4 = d4(s4);
  if (c4 !== false) return c4.item;
  if (/currentcolor/.test(e3)) {
    if (a3) e3 = e3.replace(/currentcolor/g, a3);
    else return u3(s4, null), null;
  }
  let l3 = "";
  if (ur.test(e3) && ([, l3] = e3.match(ur)), t3.colorSpace = l3, e3.includes("light-dark(")) {
    let [, n3 = ""] = k3(e3.replace(RegExp(`^${l3}\\(`), "").replace(/\)$/, "")), a4 = r3(n3, {
      colorScheme: i3,
      format: Xe
    });
    if (!a4) return u3(s4, null), null;
    if (o3 === "specifiedValue") e3 = e3.replace(n3, a4);
    else {
      let i4 = r3(a4, t3);
      if (m2(i4)) e3 = e3.replace(n3, i4);
      else return u3(s4, null), null;
    }
  }
  if (ir.test(e3)) {
    let [, i4] = e3.match(ir), [, a4] = e3.split(i4);
    if (/^[a-z]+$/.test(i4)) {
      if (!/^transparent$/.test(i4) && !Object.hasOwn(Xt, i4)) return u3(s4, null), null;
    } else if (o3 === "specifiedValue") {
      let n3 = r3(i4, t3);
      n3 && m2(n3) && (e3 = e3.replace(i4, n3));
    }
    if (o3 === "specifiedValue") {
      let r4 = pr(tokenize({ css: a4 }), t3);
      if (r4 === null) return u3(s4, null), null;
      let [i5, o4, c5, l4] = r4, d5 = "";
      d5 = h2(l4) ? ` ${i5} ${o4} ${c5} / ${l4})` : ` ${r4.join(" ")})`, a4 !== d5 && (e3 = e3.replace(a4, d5));
    }
  } else {
    let [, i4] = e3.split(dr), a4 = tokenize({ css: i4 }), o4 = [], c5 = 0, l4 = 0;
    for (let [e4, t4] of a4) {
      switch (l4++, e4) {
        case Wn:
        case qn:
          o4.push(t4), c5++;
          break;
        case zn:
          o4.at(-1) === " " ? o4[o4.length - 1] = t4 : o4.push(t4), c5--;
          break;
        case Yn: {
          let e5 = o4.at(-1);
          m2(e5) && !e5.endsWith("(") && e5 !== " " && o4.push(t4);
          break;
        }
        default:
          e4 !== Bn && e4 !== Un && o4.push(t4);
      }
      if (c5 === 0) break;
    }
    let d5 = hr(o4.join("").trim(), t3, r3);
    if (d5 === null) return u3(s4, null), null;
    let f4 = pr(a4.slice(l4), t3);
    if (f4 === null) return u3(s4, null), null;
    let [p2, g3, _4, v2] = f4, y2 = "";
    y2 = h2(v2) ? ` ${p2} ${g3} ${_4} / ${v2})` : ` ${f4.join(" ")})`, e3 = e3.replace(i4, `${d5}${y2}`);
  }
  return u3(s4, e3), e3;
}
function hr(e3, t3 = {}, r3 = () => null) {
  let { format: i3 = "" } = t3;
  if (m2(e3)) {
    if (fr.test(e3)) {
      if (i3 !== "specifiedValue") throw SyntaxError(`Unexpected token ${Le2} found.`);
      return e3;
    }
    if (!lr.test(e3)) return e3;
    e3 = e3.toLowerCase().trim();
  } else throw TypeError(`${e3} is not a string.`);
  let s4 = p({
    namespace: Zn,
    name: "resolveRelativeColor",
    value: e3
  }, t3), c4 = d4(s4);
  if (c4 !== false) return c4.item;
  let l3 = mr(e3, t3, r3);
  if (l3 === null) return u3(s4, null), null;
  if (e3 = l3, i3 === "specifiedValue") return e3.startsWith("rgba(") ? e3 = e3.replace("rgba(", "rgb(") : e3.startsWith("hsla(") && (e3 = e3.replace("hsla(", "hsl(")), e3;
  let f4 = tokenize({ css: e3 }), h3 = parseComponentValue(f4), g3 = color(h3);
  if (!g3) return u3(s4, null), null;
  let { alpha: _4, channels: v2, colorNotation: y2, syntaxFlags: b3 } = g3, x4;
  x4 = Number.isNaN(Number(_4)) ? b3 instanceof Set && b3.has(Xn) ? L3 : 0 : A(Number(_4), Qn);
  let S3, C3, w2;
  [S3, C3, w2] = v2;
  let T4;
  if (or.test(y2)) {
    let e4 = b3 instanceof Set && b3.has(Xn);
    S3 = Number.isNaN(S3) ? e4 ? L3 : 0 : A(S3, er), C3 = Number.isNaN(C3) ? e4 ? L3 : 0 : A(C3, er), w2 = Number.isNaN(w2) ? e4 ? L3 : 0 : A(w2, er), T4 = x4 === 1 ? `${y2}(${S3} ${C3} ${w2})` : `${y2}(${S3} ${C3} ${w2} / ${x4})`;
  } else if (ar.test(y2)) {
    Number.isNaN(S3) && (S3 = 0), Number.isNaN(C3) && (C3 = 0), Number.isNaN(w2) && (w2 = 0);
    let [e4, t4, n3] = An(`${y2}(${S3} ${C3} ${w2} / ${x4})`);
    e4 = A(e4 / nr, $n), t4 = A(t4 / nr, $n), n3 = A(n3 / nr, $n), T4 = x4 === 1 ? `color(srgb ${e4} ${t4} ${n3})` : `color(srgb ${e4} ${t4} ${n3} / ${x4})`;
  } else {
    let e4 = y2 === "rgb" ? "srgb" : y2, t4 = b3 instanceof Set && b3.has(Xn);
    S3 = Number.isNaN(S3) ? t4 ? L3 : 0 : A(S3, $n), C3 = Number.isNaN(C3) ? t4 ? L3 : 0 : A(C3, $n), w2 = Number.isNaN(w2) ? t4 ? L3 : 0 : A(w2, $n), T4 = x4 === 1 ? `color(${e4} ${S3} ${C3} ${w2})` : `color(${e4} ${S3} ${C3} ${w2} / ${x4})`;
  }
  return u3(s4, T4), T4;
}
var gr = "resolve";
var _r = "rgba(0, 0, 0, 0)";
var vr = RegExp(`^(?:${Ke})$`);
var yr = new RegExp(pe);
var br = /^(?:(?:ok)?l(?:ab|ch)|color(?:-mix)?|hsla?|hwb|rgba?|var)\(/;
var xr = new RegExp(ze);
var Sr = new RegExp(Be);
var Cr = new RegExp(he);
var wr = new RegExp(Je);
var Z3 = (e3, t3 = {}) => {
  if (!m2(e3)) throw TypeError(`${e3} is not a string.`);
  e3 = e3.trim();
  let { colorScheme: n3 = "normal", currentColor: r3 = "", format: i3 = z2, nullable: a3 = false } = t3, o3 = p({
    namespace: gr,
    name: "resolve",
    value: e3
  }, t3), s4 = d4(o3);
  if (s4 !== false) return s4.item;
  if (Cr.test(e3)) {
    if (i3 === "specifiedValue") return u3(o3, e3), e3;
    let n4 = ai(e3, t3);
    if (n4 === null) {
      let e4 = i3 === "hex" || i3 === "hexAlpha" || a3 ? null : _r;
      return u3(o3, e4), e4;
    }
    e3 = n4;
  }
  if (t3.format !== i3 && (t3.format = i3), e3 = e3.toLowerCase(), xr.test(e3) && e3.endsWith(")")) {
    let [r4 = "", s5 = ""] = k3(e3.replace(xr, "").replace(/\)$/, ""), { delimiter: "," });
    if (r4 && s5) {
      if (i3 === "specifiedValue") {
        let e5 = Z3(r4, t3), n4 = Z3(s5, t3), i4 = e5 && n4 ? `light-dark(${e5}, ${n4})` : "";
        return u3(o3, i4), i4;
      }
      let e4 = Z3(n3 === "dark" ? s5 : r4, t3), c6 = e4 === null && !a3 ? _r : e4;
      return u3(o3, c6), c6;
    }
    let c5;
    return c5 = i3 === "specifiedValue" ? "" : i3 === "hex" || i3 === "hexAlpha" ? null : _r, u3(o3, c5), c5;
  }
  if (Sr.test(e3)) {
    let n4 = hr(e3, t3, Z3);
    if (i3 === "computedValue") {
      let e4 = n4 === null && !a3 ? _r : n4;
      return u3(o3, e4), e4;
    }
    if (i3 === "specifiedValue") {
      let e4 = n4 === null ? "" : n4;
      return u3(o3, e4), e4;
    }
    e3 = n4 === null ? "" : n4;
  }
  yr.test(e3) && (e3 = ni(e3, t3));
  let c4 = "", l3 = NaN, f4 = NaN, h3 = NaN, g3 = NaN;
  if (e3 === "transparent") {
    let t4;
    switch (i3) {
      case Xe:
        t4 = e3;
        break;
      case "hex":
        t4 = null;
        break;
      case "hexAlpha":
        t4 = "#00000000";
        break;
      default:
        t4 = _r;
    }
    return u3(o3, t4), t4;
  }
  if (e3 === "currentcolor") {
    if (i3 === "specifiedValue") return u3(o3, e3), e3;
    if (r3) {
      let e4;
      if (e4 = r3.startsWith("color-mix(") ? Rn(r3, t3, Z3) : r3.startsWith("color(") ? On(r3, t3) : Dn(r3, t3), e4 === null) return u3(o3, null), null;
      [c4, l3, f4, h3, g3] = e4;
    } else {
      let t4 = i3 === "computedValue" ? _r : e3;
      if (i3 === "computedValue") return u3(o3, t4), t4;
    }
  } else if (i3 === "specifiedValue") {
    let n4 = "";
    if (e3.startsWith("color-mix(")) {
      let r4 = Rn(e3, t3, Z3);
      r4 && m2(r4) && (n4 = r4);
    } else if (e3.startsWith("color(")) {
      let r4 = On(e3, t3);
      if (Array.isArray(r4)) {
        let [e4, t4, i4, a4, o4] = r4;
        n4 = o4 === 1 ? `color(${e4} ${t4} ${i4} ${a4})` : `color(${e4} ${t4} ${i4} ${a4} / ${o4})`;
      }
    } else {
      let r4 = Dn(e3, t3);
      if (Array.isArray(r4)) {
        let [e4, t4, i4, a4, o4] = r4;
        n4 = e4 === "rgb" ? o4 === 1 ? `${e4}(${t4}, ${i4}, ${a4})` : `${e4}a(${t4}, ${i4}, ${a4}, ${o4})` : o4 === 1 ? `${e4}(${t4} ${i4} ${a4})` : `${e4}(${t4} ${i4} ${a4} / ${o4})`;
      } else r4 && (n4 = r4);
    }
    return u3(o3, n4), n4;
  } else if (e3.startsWith("color-mix(")) {
    r3 && (e3 = e3.replace(/currentcolor/g, r3)), e3 = e3.replace(/transparent/g, _r);
    let n4 = Rn(e3, t3, Z3);
    if (n4 === null) return u3(o3, null), null;
    [c4, l3, f4, h3, g3] = n4;
  } else if (e3.startsWith("color(")) {
    let n4 = On(e3, t3);
    if (n4 === null) return u3(o3, null), null;
    [c4, l3, f4, h3, g3] = n4;
  } else if (e3) {
    let n4 = Dn(e3, t3);
    if (n4 === null) return u3(o3, null), null;
    [c4, l3, f4, h3, g3] = n4;
  }
  let _4 = "";
  switch (i3) {
    case "hex":
    case "hexAlpha":
      _4 = Number.isNaN(l3) || Number.isNaN(f4) || Number.isNaN(h3) || Number.isNaN(g3) || i3 === "hex" && g3 === 0 ? null : gn([
        l3,
        f4,
        h3,
        i3 === "hex" ? 1 : g3
      ]);
      break;
    default:
      _4 = c4 === "rgb" ? g3 === 1 ? `${c4}(${l3}, ${f4}, ${h3})` : `${c4}a(${l3}, ${f4}, ${h3}, ${g3})` : [
        "lab",
        "lch",
        "oklab",
        "oklch"
      ].includes(c4) ? g3 === 1 ? `${c4}(${l3} ${f4} ${h3})` : `${c4}(${l3} ${f4} ${h3} / ${g3})` : g3 === 1 ? `color(${c4} ${l3} ${f4} ${h3})` : `color(${c4} ${l3} ${f4} ${h3} / ${g3})`;
  }
  return u3(o3, _4), _4;
};
var Tr = (e3, t3 = {}) => (t3.nullable = false, Z3(e3, t3));
var Er = (e3, t3 = {}) => {
  if (!m2(e3)) return false;
  let n3 = e3.toLowerCase().trim();
  if (!n3) return false;
  if (/^[a-z]+$/.test(n3)) return n3 === "currentcolor" || n3 === "transparent" || Object.hasOwn(Xt, n3);
  if (vr.test(n3) || wr.test(n3)) return true;
  if (br.test(n3)) {
    let e4 = {
      ...t3,
      nullable: true
    };
    return e4.format ||= Xe, !!Z3(n3, e4);
  }
  return false;
};
var { CloseParen: Dr, Comment: Or, Dimension: kr, EOF: Ar, Function: jr, Ident: Mr, OpenParen: Nr, Whitespace: Pr } = u;
var Fr = "css-calc-var";
var Ir = 3;
var Lr = 16;
var Rr = new RegExp(pe);
var zr = RegExp(`^calc\\((${I3})\\)$`);
var Br = new RegExp(me);
var Vr = new RegExp(he);
var Hr = new RegExp(ge);
var Ur = /\s[*+/-]\s/;
var Wr = /\($/;
var Gr = RegExp(`^(${I3})(${ue}|${de})$`);
var Kr = RegExp(`^(${I3})(${ue}|${de}|%)$`);
var qr = RegExp(`^(${I3})%$`);
var Jr = /^(?:inherit|initial|revert(?:-layer)?|unset)$/;
var Yr = class {
  #e;
  #t;
  #n;
  #r;
  #i;
  #a;
  #o;
  #s;
  #c;
  #l;
  #u;
  #d;
  #f;
  #p;
  #m;
  #h;
  #g;
  constructor() {
    this.#e = false, this.#t = [], this.#n = [], this.#r = false, this.#i = [], this.#a = [], this.#o = false, this.#s = [], this.#c = [], this.#l = [], this.#u = [], this.#d = false, this.#f = [], this.#p = [], this.#m = [], this.#h = [], this.#g = { toCanonicalUnits: true };
  }
  get hasNum() {
    return this.#e;
  }
  set hasNum(e3) {
    this.#e = !!e3;
  }
  get numSum() {
    return this.#t;
  }
  get numMul() {
    return this.#n;
  }
  get hasPct() {
    return this.#r;
  }
  set hasPct(e3) {
    this.#r = !!e3;
  }
  get pctSum() {
    return this.#i;
  }
  get pctMul() {
    return this.#a;
  }
  get hasDim() {
    return this.#o;
  }
  set hasDim(e3) {
    this.#o = !!e3;
  }
  get dimSum() {
    return this.#s;
  }
  get dimSub() {
    return this.#c;
  }
  get dimMul() {
    return this.#l;
  }
  get dimDiv() {
    return this.#u;
  }
  get hasEtc() {
    return this.#d;
  }
  set hasEtc(e3) {
    this.#d = !!e3;
  }
  get etcSum() {
    return this.#f;
  }
  get etcSub() {
    return this.#p;
  }
  get etcMul() {
    return this.#m;
  }
  get etcDiv() {
    return this.#h;
  }
  clear() {
    this.#e = false, this.#t.length = 0, this.#n.length = 0, this.#r = false, this.#i.length = 0, this.#a.length = 0, this.#o = false, this.#s.length = 0, this.#c.length = 0, this.#l.length = 0, this.#u.length = 0, this.#d = false, this.#f.length = 0, this.#p.length = 0, this.#m.length = 0, this.#h.length = 0;
  }
  sort(e3 = []) {
    let t3 = [...e3];
    return t3.length > 1 && t3.sort((e4, t4) => {
      let n3;
      if (Kr.test(e4) && Kr.test(t4)) {
        let [, r3, i3] = e4.match(Kr), [, a3, o3] = t4.match(Kr);
        n3 = i3 === o3 ? Number(r3) === Number(a3) ? 0 : Number(r3) > Number(a3) ? 1 : -1 : i3 > o3 ? 1 : -1;
      } else n3 = e4 === t4 ? 0 : e4 > t4 ? 1 : -1;
      return n3;
    }), t3;
  }
  multiply() {
    let t3 = [], n3;
    if (this.#e) {
      n3 = 1;
      for (let e3 of this.#n) if (n3 *= e3, n3 === 0 || !Number.isFinite(n3) || Number.isNaN(n3)) break;
      !this.#r && !this.#o && !this.hasEtc && (Number.isFinite(n3) && (n3 = A(n3, Lr)), t3.push(n3));
    }
    if (this.#r) {
      typeof n3 != "number" && (n3 = 1);
      for (let e3 of this.#a) if (n3 *= e3, n3 === 0 || !Number.isFinite(n3) || Number.isNaN(n3)) break;
      Number.isFinite(n3) && (n3 = `${A(n3, Lr)}%`), !this.#o && !this.hasEtc && t3.push(n3);
    }
    if (this.#o) {
      let r3 = "", i3 = "", a3 = "";
      this.#l.length && (this.#l.length === 1 ? [i3] = this.#l : i3 = `${this.sort(this.#l).join(" * ")}`), this.#u.length && (this.#u.length === 1 ? [a3] = this.#u : a3 = `${this.sort(this.#u).join(" * ")}`), Number.isFinite(n3) ? (r3 = i3 ? a3 ? a3.includes("*") ? calc(`calc(${n3} * ${i3} / (${a3}))`, this.#g) : calc(`calc(${n3} * ${i3} / ${a3})`, this.#g) : calc(`calc(${n3} * ${i3})`, this.#g) : a3.includes("*") ? calc(`calc(${n3} / (${a3}))`, this.#g) : calc(`calc(${n3} / ${a3})`, this.#g), t3.push(r3.replace(/^calc/, ""))) : (!t3.length && n3 !== void 0 && t3.push(n3), i3 ? (r3 = a3 ? a3.includes("*") ? calc(`calc(${i3} / (${a3}))`, this.#g) : calc(`calc(${i3} / ${a3})`, this.#g) : calc(`calc(${i3})`, this.#g), t3.length ? t3.push("*", r3.replace(/^calc/, "")) : t3.push(r3.replace(/^calc/, ""))) : (r3 = calc(`calc(${a3})`, this.#g), t3.length ? t3.push("/", r3.replace(/^calc/, "")) : t3.push("1", "/", r3.replace(/^calc/, ""))));
    }
    if (this.#d) {
      if (this.#m.length) {
        !t3.length && n3 !== void 0 && t3.push(n3);
        let e3 = this.sort(this.#m).join(" * ");
        t3.length ? t3.push(`* ${e3}`) : t3.push(`${e3}`);
      }
      if (this.#h.length) {
        let e3 = this.sort(this.#h).join(" * ");
        e3.includes("*") ? t3.length ? t3.push(`/ (${e3})`) : t3.push(`1 / (${e3})`) : t3.length ? t3.push(`/ ${e3}`) : t3.push(`1 / ${e3}`);
      }
    }
    return t3.length ? t3.join(" ") : "";
  }
  sum() {
    let t3 = [];
    if (this.#e) {
      let e3 = 0;
      for (let t4 of this.#t) if (e3 += t4, !Number.isFinite(e3) || Number.isNaN(e3)) break;
      t3.push(e3);
    }
    if (this.#r) {
      let e3 = 0;
      for (let t4 of this.#i) if (e3 += t4, !Number.isFinite(e3)) break;
      Number.isFinite(e3) && (e3 = `${e3}%`), t3.length ? t3.push(`+ ${e3}`) : t3.push(e3);
    }
    if (this.#o) {
      let n3, r3, i3;
      this.#s.length && (r3 = this.sort(this.#s).join(" + ")), this.#c.length && (i3 = this.sort(this.#c).join(" + ")), n3 = r3 ? i3 ? i3.includes("-") ? calc(`calc(${r3} - (${i3}))`, this.#g) : calc(`calc(${r3} - ${i3})`, this.#g) : calc(`calc(${r3})`, this.#g) : calc(`calc(-1 * (${i3}))`, this.#g), t3.length ? t3.push("+", n3.replace(/^calc/, "")) : t3.push(n3.replace(/^calc/, ""));
    }
    if (this.#d) {
      if (this.#f.length) {
        let e3 = this.sort(this.#f).map((e4) => {
          let t4;
          return t4 = Ur.test(e4) && !e4.startsWith("(") && !e4.endsWith(")") ? `(${e4})` : e4, t4;
        }).join(" + ");
        t3.length ? this.#f.length > 1 ? t3.push(`+ (${e3})`) : t3.push(`+ ${e3}`) : t3.push(`${e3}`);
      }
      if (this.#p.length) {
        let e3 = this.sort(this.#p).map((e4) => {
          let t4;
          return t4 = Ur.test(e4) && !e4.startsWith("(") && !e4.endsWith(")") ? `(${e4})` : e4, t4;
        }).join(" + ");
        t3.length ? this.#p.length > 1 ? t3.push(`- (${e3})`) : t3.push(`- ${e3}`) : this.#p.length > 1 ? t3.push(`-1 * (${e3})`) : t3.push(`-1 * ${e3}`);
      }
    }
    return t3.length ? t3.join(" ") : "";
  }
};
var Xr = (e3 = [], t3 = false) => {
  if (e3.length < Ir) throw Error(`Unexpected array length ${e3.length}.`);
  let n3 = e3.shift();
  if (!m2(n3) || !n3.endsWith("(")) throw Error(`Unexpected token ${n3}.`);
  let r3 = e3.pop();
  if (r3 !== ")") throw Error(`Unexpected token ${r3}.`);
  if (e3.length === 1) {
    let [t4] = e3;
    if (!h2(t4)) throw Error(`Unexpected token ${t4}.`);
    return `${n3}${t4}${r3}`;
  }
  let i3 = [], a3 = new Yr(), o3 = "", s4 = e3.length, c4 = false;
  for (let t4 = 0; t4 < s4; t4++) {
    let n4 = e3[t4];
    if (!h2(n4)) throw Error(`Unexpected token ${n4}.`);
    if (n4 === "*" || n4 === "/") o3 = n4;
    else if (n4 === "+" || n4 === "-") {
      let e4 = a3.multiply();
      e4 && i3.push(e4, n4), c4 = true, a3.clear(), o3 = "";
    } else {
      let e4 = Number(n4), t5 = `${n4}`;
      switch (o3) {
        case "/":
          if (Number.isFinite(e4)) a3.hasNum = true, a3.numMul.push(1 / e4);
          else if (qr.test(t5)) {
            let [, e5] = t5.match(qr);
            a3.hasPct = true, a3.pctMul.push(1e4 / Number(e5));
          } else Gr.test(t5) ? (a3.hasDim = true, a3.dimDiv.push(t5)) : (a3.hasEtc = true, a3.etcDiv.push(t5));
          break;
        default:
          if (Number.isFinite(e4)) a3.hasNum = true, a3.numMul.push(e4);
          else if (qr.test(t5)) {
            let [, e5] = t5.match(qr);
            a3.hasPct = true, a3.pctMul.push(Number(e5));
          } else Gr.test(t5) ? (a3.hasDim = true, a3.dimMul.push(t5)) : (a3.hasEtc = true, a3.etcMul.push(t5));
      }
    }
    if (t4 === s4 - 1) {
      let e4 = a3.multiply();
      e4 && i3.push(e4), a3.clear(), o3 = "";
    }
  }
  let l3 = "";
  if (t3 && c4) {
    let e4 = [];
    a3.clear(), o3 = "";
    let t4 = i3.length;
    for (let n4 = 0; n4 < t4; n4++) {
      let r4 = i3[n4];
      if (h2(r4)) {
        if (r4 === "+" || r4 === "-") o3 = r4;
        else {
          let e5 = Number(r4), t5 = `${r4}`;
          switch (o3) {
            case "-":
              if (Number.isFinite(e5)) a3.hasNum = true, a3.numSum.push(-1 * e5);
              else if (qr.test(t5)) {
                let [, e6] = t5.match(qr);
                a3.hasPct = true, a3.pctSum.push(-1 * Number(e6));
              } else Gr.test(t5) ? (a3.hasDim = true, a3.dimSub.push(t5)) : (a3.hasEtc = true, a3.etcSub.push(t5));
              break;
            default:
              if (Number.isFinite(e5)) a3.hasNum = true, a3.numSum.push(e5);
              else if (qr.test(t5)) {
                let [, e6] = t5.match(qr);
                a3.hasPct = true, a3.pctSum.push(Number(e6));
              } else Gr.test(t5) ? (a3.hasDim = true, a3.dimSum.push(t5)) : (a3.hasEtc = true, a3.etcSum.push(t5));
          }
        }
      }
      if (n4 === t4 - 1) {
        let t5 = a3.sum();
        t5 && e4.push(t5), a3.clear(), o3 = "";
      }
    }
    l3 = e4.join(" ").replace(/\+\s-/g, "- ");
  } else l3 = i3.join(" ").replace(/\+\s-/g, "- ");
  return l3.startsWith("(") && l3.endsWith(")") && l3.lastIndexOf("(") === 0 && l3.indexOf(")") === l3.length - 1 && (l3 = l3.substring(1, l3.length - 1)), `${n3}${l3}${r3}`;
};
var Zr = (e3) => {
  let t3 = tokenize({ css: e3 }), r3 = [], i3 = "", a3 = "", o3 = 0;
  for (let e4 of t3) {
    let [t4, n3] = e4;
    if (t4 === Nr || t4 === jr ? o3++ : t4 === Dr && o3--, o3 === 0 && (n3 === "+" || n3 === "-")) {
      i3.trim() && r3.push((a3 === "-" ? "-" : "") + i3.trim()), i3 = "", a3 = n3;
      continue;
    }
    i3 += n3;
  }
  i3.trim() && r3.push((a3 === "-" ? "-" : "") + i3.trim()), r3.sort((e4, t4) => {
    let n3 = /^(-?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]*)$/i, r4 = e4.match(n3), i4 = t4.match(n3);
    if (r4 && i4) {
      let e5 = Number(r4[1] ?? "0"), t5 = Number(i4[1] ?? "0"), n4 = r4[2] ?? "", a4 = i4[2] ?? "";
      return n4 === a4 ? e5 - t5 : n4 > a4 ? 1 : -1;
    }
    return e4 === t4 ? 0 : e4 > t4 ? 1 : -1;
  });
  let s4 = r3[0];
  if (s4 === void 0) return e3;
  let c4 = s4;
  for (let e4 = 1; e4 < r3.length; e4++) {
    let t4 = r3[e4] ?? "";
    t4.startsWith("-") ? c4 += " - " + t4.substring(1) : t4 && (c4 += " + " + t4);
  }
  return c4;
};
var Qr = (t3, n3) => {
  let r3 = t3[0], i3 = m2(r3) && Br.test(r3), a3 = [];
  for (let e3 of t3) Array.isArray(e3) ? a3.push(Qr(e3, i3)) : a3.push(e3);
  let o3 = a3.includes(","), s4 = a3[0] ?? "", c4 = m2(s4) && Br.test(s4);
  if (o3 && c4 && a3.at(-1) === ")") {
    let e3 = a3.shift(), t4 = a3.pop(), n4 = [], r4 = [];
    for (let e4 of a3) e4 === "," ? (n4.push(r4), r4 = []) : r4.push(e4);
    return r4.length && n4.push(r4), `${e3}${n4.map((e4) => {
      if (e4.length >= Ir) {
        let t5 = Xr([
          "calc(",
          ...e4,
          ")"
        ], true);
        return Zr(t5.substring(5, t5.length - 1));
      }
      if (e4.length === 1) {
        let t5 = e4[0];
        if (m2(t5) && t5.startsWith("calc(") && t5.endsWith(")")) return Zr(t5.substring(5, t5.length - 1));
      }
      return e4.join("");
    }).join(", ")}${t4}`;
  }
  if (n3) {
    if (!o3) {
      if (a3.length >= Ir) return Xr(a3, true);
      let e3 = a3[0] ?? "";
      return e3.endsWith("(") ? a3.join("") : e3.startsWith("calc(") || /^[a-z-]+\(/.test(e3) ? e3 : `calc(${e3})`;
    }
    return a3.join("").replace(/,\s*/g, ", ");
  }
  if (a3.length >= Ir && !o3) {
    let t4 = Xr(a3, false);
    return Hr.test(t4) && (t4 = calc(t4, { toCanonicalUnits: true })), t4;
  }
  return a3.join("").replace(/,\s*/g, ", ");
};
var $r = (e3, t3 = {}) => {
  let { format: r3 = "" } = t3;
  if (m2(e3)) {
    if (!Hr.test(e3) || r3 !== "specifiedValue") return e3;
    e3 = e3.toLowerCase().trim();
  } else throw TypeError(`${e3} is not a string.`);
  let i3 = p({
    namespace: Fr,
    name: "serializeCalc",
    value: e3
  }, t3), a3 = d4(i3);
  if (a3 !== false) return a3.item;
  let o3 = tokenize({ css: e3 }).map((e4) => {
    let [t4, n3] = e4, r4 = "";
    return t4 !== Pr && t4 !== Or && (r4 = n3), r4;
  }).filter((e4) => e4), s4 = [[]];
  for (let e4 of o3) if (Wr.test(e4)) {
    let t4 = [e4], n3 = s4.at(-1);
    n3 && n3.push(t4), s4.push(t4);
  } else if (e4 === ")") {
    if (s4.length > 1) {
      let t4 = s4.pop();
      t4 && t4.push(e4);
    } else {
      let t4 = s4[0];
      t4 && t4.push(e4);
    }
  } else {
    let t4 = s4.at(-1);
    t4 && t4.push(e4);
  }
  let c4 = "", l3 = s4[0];
  return l3 && (c4 = l3.length === 1 && Array.isArray(l3[0]) ? Qr(l3[0], true) : Qr(l3, true)), u3(i3, c4), c4;
};
var ei = (e3, t3 = {}) => {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  let [, , , , n3 = {}] = e3, { unit: r3, value: i3 } = n3;
  if (r3 === "px") return `${i3}${r3}`;
  let a3 = F(Number(i3), r3, t3);
  return Number.isFinite(a3) ? `${A(a3, Lr)}px` : null;
};
var ti = (e3, t3 = {}) => {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  let { format: n3 = "" } = t3, r3 = /* @__PURE__ */ new Set(), i3 = 0, a3 = [];
  for (let o3 of e3) {
    if (!Array.isArray(o3)) throw TypeError(`${o3} is not an array.`);
    let [e4 = "", s4 = ""] = o3;
    switch (e4) {
      case kr:
        if (n3 === "specifiedValue" && !r3.has(i3)) a3.push(s4);
        else {
          let e5 = ei(o3, t3);
          m2(e5) ? a3.push(e5) : a3.push(s4);
        }
        break;
      case jr:
      case Nr:
        a3.push(s4), i3++, Br.test(s4) && r3.add(i3);
        break;
      case Dr:
        a3.length && a3.at(-1) === " " ? a3.splice(-1, 1, s4) : a3.push(s4), r3.has(i3) && r3.delete(i3), i3--;
        break;
      case Pr:
        if (a3.length) {
          let e5 = a3.at(-1);
          m2(e5) && !e5.endsWith("(") && e5 !== " " && a3.push(s4);
        }
        break;
      default:
        e4 !== Or && e4 !== Ar && a3.push(s4);
    }
  }
  return a3;
};
var ni = (t3, r3 = {}) => {
  let { format: i3 = "" } = r3;
  if (m2(t3)) {
    if (Vr.test(t3)) {
      if (i3 === "specifiedValue") return t3;
      {
        let e3 = ai(t3, r3);
        return m2(e3) ? e3 : "";
      }
    }
    if (!Rr.test(t3)) return t3;
    t3 = t3.toLowerCase().trim();
  } else throw TypeError(`${t3} is not a string.`);
  let a3 = p({
    namespace: Fr,
    name: "cssCalc",
    value: t3
  }, r3), o3 = d4(a3);
  if (o3 !== false) return o3.item;
  let s4 = ti(tokenize({ css: t3 }), r3), c4 = calc(s4.join(""), { toCanonicalUnits: true });
  if (Hr.test(t3)) {
    if (Kr.test(c4)) {
      let [, e3, t4] = c4.match(Kr);
      c4 = `${A(Number(e3), Lr)}${t4}`;
    }
    c4 && !Hr.test(c4) && i3 === "specifiedValue" && (c4 = `calc(${c4})`);
  }
  if (i3 === "specifiedValue") {
    if (/\s[-+*/]\s/.test(c4) && !c4.includes("NaN")) c4 = $r(c4, r3);
    else if (zr.test(c4)) {
      let [, e3] = c4.match(zr);
      c4 = `calc(${A(Number(e3), Lr)})`;
    }
  }
  return u3(a3, c4), c4;
};
function ri(e3, t3 = {}) {
  if (!Array.isArray(e3)) throw TypeError(`${e3} is not an array.`);
  let { customProperty: n3 = {} } = t3, r3 = [];
  for (; e3.length; ) {
    let i4 = e3.shift();
    if (!i4) break;
    if (!Array.isArray(i4)) throw TypeError(`${i4} is not an array.`);
    let [a4, o3] = i4;
    if (a4 === Dr) break;
    if (o3 === "var(") {
      let [, n4] = ri(e3, t3);
      n4 && r3.push(n4);
    } else if (o3 && a4 === Mr) {
      if (o3.startsWith("--")) {
        let e4;
        Object.hasOwn(n3, o3) ? e4 = n3[o3] : typeof n3.callback == "function" && (e4 = n3.callback(o3)), e4 && r3.push(e4);
      } else r3.push(o3);
    }
  }
  let i3 = false;
  r3.length > 1 && (i3 = Er(r3.at(-1)));
  let a3 = "";
  for (let e4 of r3) {
    if (e4 = e4.trim(), Vr.test(e4)) {
      let n4 = ai(e4, t3);
      m2(n4) && (!i3 || Er(n4)) && (a3 = n4);
    } else Rr.test(e4) ? (e4 = ni(e4, t3), (!i3 || Er(e4)) && (a3 = e4)) : e4 && !Jr.test(e4) && (!i3 || Er(e4)) && (a3 = e4);
    if (a3) break;
  }
  return [e3, a3];
}
function ii(e3, t3 = {}) {
  let n3 = [];
  for (; e3.length; ) {
    let r3 = e3.shift();
    if (!r3) break;
    let [i3 = "", a3 = ""] = r3;
    if (a3 === "var(") {
      let [, r4] = ri(e3, t3);
      if (!r4) return null;
      n3.push(r4);
    } else switch (i3) {
      case Dr:
        n3.length && n3.at(-1) === " " ? n3[n3.length - 1] = a3 : n3.push(a3);
        break;
      case Pr:
        if (n3.length) {
          let e4 = n3.at(-1);
          m2(e4) && !e4.endsWith("(") && e4 !== " " && n3.push(a3);
        }
        break;
      default:
        i3 !== Or && i3 !== Ar && n3.push(a3);
    }
  }
  return n3;
}
function ai(e3, t3 = {}) {
  let { format: r3 = "" } = t3;
  if (m2(e3)) {
    if (!Vr.test(e3) || r3 === "specifiedValue") return e3;
    e3 = e3.trim();
  } else throw TypeError(`${e3} is not a string.`);
  let i3 = p({
    namespace: Fr,
    name: "resolveVar",
    value: e3
  }, t3), a3 = d4(i3);
  if (a3 !== false) return a3.item;
  let o3 = ii(tokenize({ css: e3 }), t3);
  if (Array.isArray(o3)) {
    let e4 = o3.join("");
    return Rr.test(e4) && (e4 = ni(e4, t3)), u3(i3, e4), e4;
  }
  return u3(i3, null), null;
}
var oi = (e3, t3 = {}) => {
  let n3 = ai(e3, t3);
  return m2(n3) ? n3 : "";
};
var si = "css-gradient";
var ci = `${I3}(?:${ue})`;
var li = `${ci}|${R3}`;
var Q2 = `${`${I3}(?:${de})|0`}|${R3}`;
var ui = `${fe}(?:${de}|%)|0`;
var di = `${fe}(?:${de})|0`;
var $2 = "center";
var fi = "left|right";
var pi = "top|bottom";
var mi = "start|end";
var hi = `${fi}|x-(?:${mi})`;
var gi = `${pi}|y-(?:${mi})`;
var _i = `block-(?:${mi})`;
var vi = `inline-(?:${mi})`;
var yi = `${$2}|${hi}|${gi}|${_i}|${vi}|${Q2}`;
var bi = [
  `(?:${$2}|${hi})\\s+(?:${$2}|${gi})`,
  `(?:${$2}|${gi})\\s+(?:${$2}|${hi})`,
  `(?:${$2}|${hi}|${Q2})\\s+(?:${$2}|${gi}|${Q2})`,
  `(?:${$2}|${_i})\\s+(?:${$2}|${vi})`,
  `(?:${$2}|${vi})\\s+(?:${$2}|${_i})`,
  `(?:${$2}|${mi})\\s+(?:${$2}|${mi})`
].join("|");
var xi = [
  `(?:${hi})\\s+(?:${Q2})\\s+(?:${gi})\\s+(?:${Q2})`,
  `(?:${gi})\\s+(?:${Q2})\\s+(?:${hi})\\s+(?:${Q2})`,
  `(?:${_i})\\s+(?:${Q2})\\s+(?:${vi})\\s+(?:${Q2})`,
  `(?:${vi})\\s+(?:${Q2})\\s+(?:${_i})\\s+(?:${Q2})`,
  `(?:${mi})\\s+(?:${Q2})\\s+(?:${mi})\\s+(?:${Q2})`
].join("|");
var Si = "(?:clos|farth)est-(?:corner|side)";
var Ci = [
  `${Si}(?:\\s+${Si})?`,
  `${di}`,
  `(?:${ui})\\s+(?:${ui})`
].join("|");
var wi = "circle|ellipse";
var Ti = `from\\s+${ci}`;
var Ei = `at\\s+(?:${yi}|${bi}|${xi})`;
var Di = `to\\s+(?:(?:${fi})(?:\\s(?:${pi}))?|(?:${pi})(?:\\s(?:${fi}))?)`;
var Oi = `in\\s+(?:${Me2}|${Ee})`;
var ki = [`(?:${ci}|${Di})(?:\\s+${Oi})?`, `${Oi}(?:\\s+(?:${ci}|${Di}))?`].join("|");
var Ai = [
  `(?:${wi})(?:\\s+(?:${Ci}))?(?:\\s+${Ei})?(?:\\s+${Oi})?`,
  `(?:${Ci})(?:\\s+(?:${wi}))?(?:\\s+${Ei})?(?:\\s+${Oi})?`,
  `${Ei}(?:\\s+${Oi})?`,
  `${Oi}(?:\\s+${wi})(?:\\s+(?:${Ci}))?(?:\\s+${Ei})?`,
  `${Oi}(?:\\s+${Ci})(?:\\s+(?:${wi}))?(?:\\s+${Ei})?`,
  `${Oi}(?:\\s+${Ei})?`
].join("|");
var ji = [
  `${Ti}(?:\\s+${Ei})?(?:\\s+${Oi})?`,
  `${Ei}(?:\\s+${Oi})?`,
  `${Oi}(?:\\s+${Ti})?(?:\\s+${Ei})?`
].join("|");
var Mi = [/to\s+bottom/];
var Ni = [
  /ellipse/,
  /farthest-corner/,
  /at\s+center/
];
var Pi = [/at\s+center/];
var Fi = /^(?:repeating-)?conic-gradient$/;
var Ii = /^(?:repeating-)?linear-gradient$/;
var Li = /^(?:repeating-)?radial-gradient$/;
var Ri = RegExp(`^(?:${li})$`);
var zi = RegExp(`^(?:${Q2})$`);
var Bi = RegExp(`(?:\\s+(?:${li})){1,2}$`);
var Vi = RegExp(`(?:\\s+(?:${Q2})){1,2}$`);
var Hi = /^(?:repeating-)?(?:conic|linear|radial)-gradient\(/;
var Ui = /^((?:repeating-)?(?:conic|linear|radial)-gradient)\(/;
var Wi = RegExp(`^(?:${ji})$`);
var Gi = RegExp(`^(?:${ki})$`);
var Ki = RegExp(`^(?:${Ai})$`);
var qi = (e3) => {
  if (m2(e3) && (e3 = e3.trim(), Hi.test(e3))) {
    let [, t3] = e3.match(Ui);
    return t3;
  }
  return "";
};
var Ji = (e3, t3) => {
  if (m2(e3) && m2(t3)) {
    e3 = e3.trim(), t3 = t3.trim();
    let n3 = null, r3 = [];
    if (Ii.test(t3) ? (n3 = Gi, r3 = Mi) : Li.test(t3) ? (n3 = Ki, r3 = Ni) : Fi.test(t3) && (n3 = Wi, r3 = Pi), n3) {
      let t4 = n3.test(e3);
      if (t4) {
        let n4 = e3;
        for (let e4 of r3) n4 = n4.replace(e4, "");
        return n4 = n4.replace(/\s{2,}/g, " ").trim(), {
          line: n4,
          valid: t4
        };
      }
      return {
        valid: t4,
        line: e3
      };
    }
  }
  return {
    line: e3,
    valid: false
  };
};
var Yi = (e3, t3, n3 = {}) => {
  if (Array.isArray(e3) && e3.length > 1) {
    let r3 = Fi.test(t3), i3 = r3 ? Ri : zi, a3 = r3 ? Bi : Vi, o3 = [], s4 = "";
    for (let t4 = 0; t4 < e3.length; t4++) {
      let r4 = e3[t4];
      if (m2(r4)) {
        if (i3.test(r4)) {
          if (t4 === 0 || s4 === "hint") return {
            colorStops: e3,
            valid: false
          };
          s4 = "hint", o3.push(r4);
        } else {
          let t5 = r4.replace(a3, "");
          if (Er(t5, { format: "specifiedValue" })) {
            let e4 = Z3(t5, n3);
            s4 = "color", o3.push(r4.replace(t5, e4));
          } else return {
            colorStops: e3,
            valid: false
          };
        }
      } else return {
        colorStops: e3,
        valid: false
      };
    }
    return s4 === "color" ? {
      valid: true,
      colorStops: o3
    } : {
      colorStops: e3,
      valid: false
    };
  }
  return {
    colorStops: e3,
    valid: false
  };
};
var Xi = (e3, t3 = {}) => {
  if (m2(e3)) {
    e3 = e3.trim();
    let n3 = p({
      namespace: si,
      name: "parseGradient",
      value: e3
    }, t3), r3 = d4(n3);
    if (r3 !== false) return r3.item;
    let i3 = qi(e3), a3 = e3.replace(Hi, "").replace(/\)$/, "");
    if (i3 && a3) {
      let [r4 = "", ...o3] = k3(a3, { delimiter: "," }), s4 = Fi.test(i3) ? Bi : Vi, c4 = "";
      if (s4.test(r4)) {
        let e4 = r4.replace(s4, "");
        if (Er(e4, { format: "specifiedValue" })) {
          let n4 = Z3(e4, t3);
          c4 = r4.replace(e4, n4);
        }
      } else Er(r4, { format: "specifiedValue" }) && (c4 = Z3(r4, t3));
      if (c4) {
        o3.unshift(c4);
        let { colorStops: r5, valid: a4 } = Yi(o3, i3, t3);
        if (a4) {
          let t4 = {
            value: e3,
            type: i3,
            colorStopList: r5
          };
          return u3(n3, t4), t4;
        }
      } else if (o3.length > 1) {
        let { line: a4, valid: s5 } = Ji(r4, i3), { colorStops: c5, valid: l3 } = Yi(o3, i3, t3);
        if (s5 && l3) {
          let t4 = {
            value: e3,
            type: i3,
            gradientLine: a4,
            colorStopList: c5
          };
          return u3(n3, t4), t4;
        }
      }
    }
    return u3(n3, null), null;
  }
  return null;
};
var Zi = (e3, t3 = {}) => {
  let { format: n3 = z2 } = t3, r3 = Xi(e3, t3);
  if (r3) {
    let { type: e4 = "", gradientLine: t4 = "", colorStopList: n4 = [] } = r3;
    if (e4 && Array.isArray(n4) && n4.length > 1) return t4 ? `${e4}(${t4}, ${n4.join(", ")})` : `${e4}(${n4.join(", ")})`;
  }
  return n3 === "specifiedValue" ? "" : "none";
};
var Qi = (e3, t3 = {}) => Xi(e3, t3) !== null;
var $i = "convert";
var ea = new RegExp(pe);
var ta = new RegExp(Be);
var na = new RegExp(he);
var ra = (e3, t3 = {}) => {
  if (!m2(e3) || (e3 = e3.trim(), !e3)) return null;
  let n3 = p({
    namespace: $i,
    name: "preProcess",
    value: e3
  }, t3), r3 = d4(n3);
  if (r3 !== false) return r3.item;
  let i3 = e3;
  if (na.test(e3)) {
    let r4 = ai(e3, t3);
    if (m2(r4)) i3 = r4;
    else return u3(n3, null), null;
  }
  if (ta.test(i3)) {
    let e4 = hr(i3, t3);
    if (m2(e4)) i3 = e4;
    else return u3(n3, null), null;
  } else ea.test(i3) && (i3 = ni(i3, t3));
  if (i3.startsWith("color-mix")) {
    let e4 = Z3(i3, {
      ...t3,
      format: z2,
      nullable: true
    });
    i3 = typeof e4 == "string" ? e4 : null;
  }
  return u3(n3, i3), i3;
};
var ia = (e3, t3, n3) => (r3, i3 = {}) => {
  if (!m2(r3)) throw TypeError(`${r3} is not a string.`);
  let a3 = ra(r3, i3);
  if (a3 === null) return [
    0,
    0,
    0,
    0
  ];
  let o3 = a3.toLowerCase(), s4 = p({
    namespace: $i,
    name: e3,
    value: o3
  }, i3), c4 = d4(s4);
  if (c4 !== false) return c4.item;
  let l3 = n3(o3, {
    ...i3,
    format: t3
  });
  return u3(s4, l3), l3;
};
var aa = (e3) => en(e3);
var oa = (e3, t3 = {}) => {
  if (!m2(e3)) throw TypeError(`${e3} is not a string.`);
  let n3 = ra(e3, t3);
  if (n3 === null) return null;
  let r3 = n3.toLowerCase(), i3 = p({
    namespace: $i,
    name: "colorToHex",
    value: r3
  }, t3), a3 = d4(i3);
  if (a3 !== false) return a3.item;
  let o3 = Z3(r3, {
    ...t3,
    nullable: true,
    format: t3.alpha ? "hexAlpha" : "hex"
  });
  return m2(o3) ? (u3(i3, o3), o3) : (u3(i3, null), null);
};
var sa = ia("colorToHsl", "hsl", Mn);
var ca = ia("colorToHwb", "hwb", Nn);
var la = ia("colorToLab", "lab", Pn);
var ua = ia("colorToLch", "lch", Fn);
var da = ia("colorToOklab", "oklab", In);
var fa = ia("colorToOklch", "oklch", Ln);
var pa = ia("colorToRgb", "rgb", An);
var ma = (e3, t3 = {}) => {
  if (!m2(e3)) throw TypeError(`${e3} is not a string.`);
  let n3 = ra(e3, t3);
  if (n3 === null) return [
    0,
    0,
    0,
    0
  ];
  let r3 = n3.toLowerCase(), i3 = p({
    namespace: $i,
    name: "colorToXyz",
    value: r3
  }, t3), a3 = d4(i3);
  if (a3 !== false) return a3.item;
  let o3;
  o3 = r3.startsWith("color(") ? Y3(r3, t3) : X2(r3, t3);
  let [, ...s4] = o3;
  return u3(i3, s4), s4;
};
var ha = {
  colorToHex: oa,
  colorToHsl: sa,
  colorToHwb: ca,
  colorToLab: la,
  colorToLch: ua,
  colorToOklab: da,
  colorToOklch: fa,
  colorToRgb: pa,
  colorToXyz: ma,
  colorToXyzD50: (e3, t3 = {}) => (t3.d50 = true, ma(e3, t3)),
  numberToHex: aa
};
var ga = {
  cssCalc: ni,
  cssVar: oi,
  extractDashedIdent: ie,
  isColor: Er,
  isGradient: Qi,
  resolveGradient: Zi,
  resolveLengthInPixels: F,
  splitValue: k3
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convert,
  resolve,
  utils
});
/*! Bundled license information:

@csstools/color-helpers/dist/index.mjs:
  (**
   * Bradford chromatic adaptation from D50 to D65
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Bradford chromatic adaptation from D65 to D50
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html
   *)
  (**
   * @param {number} hue - Hue as degrees 0..360
   * @param {number} sat - Saturation as percentage 0..100
   * @param {number} light - Lightness as percentage 0..100
   * @return {number[]} Array of sRGB components; in-gamut colors in range [0..1]
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/hslToRgb.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/hslToRgb.js
   *)
  (**
   * @param {number} hue -  Hue as degrees 0..360
   * @param {number} white -  Whiteness as percentage 0..100
   * @param {number} black -  Blackness as percentage 0..100
   * @return {number[]} Array of RGB components 0..1
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/hwbToRgb.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/hwbToRgb.js
   *)
  (**
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert Lab to D50-adapted XYZ
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   *)
  (**
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js
   *)
  (**
   * Given OKLab, convert to XYZ relative to D65
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js
   *)
  (**
   * Assuming XYZ is relative to D50, convert to CIE Lab
   * from CIE standard, which now defines these as a rational fraction
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *
   * XYZ <-> LMS matrices recalculated for consistent reference white
   * @see https://github.com/w3c/csswg-drafts/issues/6642#issuecomment-943521484
   *)
  (**
   * Convert XYZ to linear-light rec2020
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert XYZ to linear-light P3
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert D50 XYZ to linear-light prophoto-rgb
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   *)
  (**
   * Convert XYZ to linear-light a98-rgb
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light rec2020 RGB  in the range 0.0-1.0
   * to gamma corrected form ITU-R BT.2020-2 p.4
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light sRGB values in the range 0.0-1.0 to gamma corrected form
   * Extended transfer function:
   *  For negative values, linear portion extends on reflection
   *  of axis, then uses reflected pow below that
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://en.wikipedia.org/wiki/SRGB
   *)
  (**
   * Convert an array of linear-light display-p3 RGB in the range 0.0-1.0
   * to gamma corrected form
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light prophoto-rgb in the range 0.0-1.0
   * to gamma corrected form.
   * Transfer curve is gamma 1.8 with a small linear portion.
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light a98-rgb in the range 0.0-1.0
   * to gamma corrected form. Negative values are also now accepted
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of rec2020 RGB values in the range 0.0 - 1.0
   * to linear light (un-companded) form.
   * ITU-R BT.2020-2 p.4
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light rec2020 values to CIE XYZ
   * using  D65 (no chromatic adaptation)
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   *)
  (**
   * Convert an array of of sRGB values where in-gamut values are in the range
   * [0 - 1] to linear light (un-companded) form.
   * Extended transfer function:
   *  For negative values, linear portion is extended on reflection of axis,
   *  then reflected power function is used.
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://en.wikipedia.org/wiki/SRGB
   *)
  (**
   * Convert an array of display-p3 RGB values in the range 0.0 - 1.0
   * to linear light (un-companded) form.
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light display-p3 values to CIE XYZ
   * using D65 (no chromatic adaptation)
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   *)
  (**
   * Convert an array of prophoto-rgb values where in-gamut Colors are in the
   * range [0.0 - 1.0] to linear light (un-companded) form. Transfer curve is
   * gamma 1.8 with a small linear portion. Extended transfer function
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light prophoto-rgb values to CIE D50 XYZ.
   * Matrix cannot be expressed in rational form, but is calculated to 64 bit accuracy.
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see see https://github.com/w3c/csswg-drafts/issues/7675
   *)
  (**
   * Convert an array of a98-rgb values in the range 0.0 - 1.0
   * to linear light (un-companded) form. Negative values are also now accepted
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of linear-light a98-rgb values to CIE XYZ
   * http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   * has greater numerical precision than section 4.3.5.3 of
   * https://www.adobe.com/digitalimag/pdfs/AdobeRGB1998.pdf
   * but the values below were calculated from first principles
   * from the chromaticity coordinates of R G B W
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   * @see https://www.adobe.com/digitalimag/pdfs/AdobeRGB1998.pdf
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/matrixmaker.html
   *)
  (**
   * Convert an array of linear-light sRGB values to CIE XYZ
   * using sRGB's own white, D65 (no chromatic adaptation)
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/conversions.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *)
  (**
   * Convert an array of gamma-corrected sRGB values in the 0.0 to 1.0 range to HSL.
   *
   * @param {Color} RGB [r, g, b]
   * - Red component 0..1
   * - Green component 0..1
   * - Blue component 0..1
   * @return {number[]} Array of HSL values: Hue as degrees 0..360, Saturation and Lightness as percentages 0..100
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/utilities.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   *
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/better-rgbToHsl.js
   *)

@csstools/color-helpers/dist/index.mjs:
  (**
   * @description Calculate deltaE OK which is the simple root sum of squares
   * @param {number[]} reference - Array of OKLab values: L as 0..1, a and b as -1..1
   * @param {number[]} sample - Array of OKLab values: L as 0..1, a and b as -1..1
   * @return {number} How different a color sample is from reference
   *
   * @license W3C https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
   * @copyright This software or document includes material copied from or derived from https://github.com/w3c/csswg-drafts/blob/main/css-color-4/deltaEOK.js. Copyright © 2022 W3C® (MIT, ERCIM, Keio, Beihang).
   * @see https://github.com/w3c/csswg-drafts/blob/main/css-color-4/deltaEOK.js
   *)

@csstools/color-helpers/dist/index.mjs:
  (**
   * @license MIT https://github.com/facelessuser/coloraide/blob/main/LICENSE.md
   *)
*/
