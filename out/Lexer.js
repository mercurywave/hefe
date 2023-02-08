import { Match, Syntax } from "./patterns.js";
export class Lexer {
    static Tokenize(code) {
        let trim = code.trimStart();
        let TabDepth = code.length - trim.length;
        var arr = trim.split("");
        let idx = 0;
        let Tokens = [];
        let details = [];
        while (idx < arr.length) {
            var result = _symbols.firstPartialMatch(arr, idx);
            if (result == null) {
                throw "could not lex from: " + arr.slice(idx).join("");
            }
            var len = result.result.length;
            const token = arr.slice(idx, idx + len).join("");
            if (result.output != eTokenType.comment && result.output != eTokenType.whiteSpace) { // ignoring spaces/comments, etc.
                Tokens.push(token);
            }
            details.push({ token, type: result.output, start: idx + TabDepth });
            idx += len;
        }
        return { TabDepth, Tokens, original: code, details };
    }
    static getTokenAt(tokes, index) {
        for (const t of tokes) {
            if (index >= t.start && index < t.start + t.token.length)
                return t.type;
        }
        return eTokenType.whiteSpace;
    }
}
export var eTokenType;
(function (eTokenType) {
    eTokenType[eTokenType["symbol"] = 0] = "symbol";
    eTokenType[eTokenType["literalString"] = 1] = "literalString";
    eTokenType[eTokenType["literalNumber"] = 2] = "literalNumber";
    eTokenType[eTokenType["comment"] = 3] = "comment";
    eTokenType[eTokenType["identifier"] = 4] = "identifier";
    eTokenType[eTokenType["whiteSpace"] = 5] = "whiteSpace";
})(eTokenType || (eTokenType = {}));
const _symbols = new Syntax()
    .add([whitespace()], eTokenType.whiteSpace)
    .add([tokens(":=", ">>", "!=", "<=", ">=", "<<")], eTokenType.symbol)
    .add([tokens("//"), Match.anything(true)], eTokenType.comment)
    .add([symbols("+-=/*!;\\(),.:<>&|")], eTokenType.symbol)
    .add([number()], eTokenType.literalNumber)
    .add([word()], eTokenType.identifier)
    .add([tokens("\"\"")], eTokenType.literalString) // easier to special case an empty string
    .add(literalString(), eTokenType.literalString);
function tokens(...matches) {
    return Match.sequences(matches.map(s => s.split("")));
}
function symbols(symbols) {
    return Match.anyOf(symbols.split(""));
}
function whitespace() {
    return Match.matchWhile(t => t == " " || t == "\t");
}
function word() {
    return Match.testSequence(t => {
        return !!t.join("").match(/^[$A-Z_][0-9A-Z_$]*$/i);
    }, false, "word");
}
function number() {
    return Match.testSequence(t => {
        let test = t.join("");
        // this is a bit hacky because the test sequence is greedy
        // we also want a negative to be a unary operator
        // also, don't want 
        if (test[test.length - 1] === ".")
            return null;
        return !test.includes(" ") && !test.includes("-") && !isNaN(+test) && isFinite(+test);
    }, false, "num");
}
function literalString() {
    return [
        Match.token("\""),
        Match.matchWhileAt((tokes, idx) => {
            return !(tokes[idx] === "\"" && symCountBackwards(tokes, idx - 1, "\\") % 2 == 0);
        }),
        Match.token("\"")
    ];
}
function symCountBackwards(str, idx, symbol) {
    let count = 0;
    for (; idx > 0; idx--) {
        if (str[idx] != symbol)
            break;
        count++;
    }
    return count;
}
//# sourceMappingURL=Lexer.js.map