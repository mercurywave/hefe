import { Match, Syntax } from "./patterns.js";
export class Lexer {
    static Tokenize(code) {
        let trim = code.trimStart();
        let TabDepth = code.length - trim.length;
        var arr = trim.split("");
        let idx = 0;
        let Tokens = [];
        while (idx < arr.length) {
            var result = _symbols.firstPartialMatch(arr, idx);
            if (result == null) {
                throw "could not lex from: " + arr.slice(idx).join("");
            }
            var len = result.result.length;
            if (result.output) { // ignoring spaces/comments, etc.
                Tokens.push(arr.slice(idx, idx + len).join(""));
            }
            idx += len;
        }
        return { TabDepth, Tokens, original: code };
    }
}
const _symbols = new Syntax()
    .add([symbols(" \t")], false)
    .add([tokens(":=", ">>", "!=")], true)
    .add([symbols("+-=/*!;\\()")], true)
    .add([number()], true)
    .add([word()], true)
    .add([tokens("\"\"")], true) // easier to special case an empty string
    .add(literalString(), true);
function tokens(...matches) {
    return Match.sequences(matches.map(s => s.split("")));
}
function symbols(symbols) {
    return Match.anyOf(symbols.split(""));
}
function word() {
    return Match.testSequence(t => {
        return !!t.join("").match(/^[$A-Z_][0-9A-Z_$]*$/i);
    }, "word");
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
    }, "num");
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