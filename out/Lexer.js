import { Match, pattern, Syntax } from "./patterns.js";
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
    static isToken(toke) {
    }
}
const _symbols = new Syntax()
    .add(symbols(" \t"), false)
    .add(token(":="), true)
    .add(token(">>"), true)
    .add(symbols("+-=/*!;\\()"), true)
    .add(number(), true)
    .add(word(), true);
function token(match) {
    return pattern(Match.sequence(match.split("")));
}
function symbols(symbols) {
    return pattern(Match.anyOf(symbols.split("")));
}
function word() {
    return pattern(Match.testSequence(t => {
        return !!t.join("").match(/^[$A-Z_][0-9A-Z_$]*$/i);
    }, "word"));
}
function number() {
    return pattern(Match.testSequence(t => {
        let test = t.join("");
        // this is a bit hacky because the test sequence is greedy
        // we also want a negative to be a unary operator
        // also, don't want 
        if (test[test.length - 1] === ".")
            return null;
        return !test.includes(" ") && !test.includes("-") && !isNaN(+test) && isFinite(+test);
    }, "num"));
}
//# sourceMappingURL=Lexer.js.map