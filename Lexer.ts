import { Match, pattern, Pattern, SingleMatch, Syntax } from "./patterns.js";

export class Lexer{
    public static Tokenize(code: string): LexLine{
        let trim = code.trimStart();
        let TabDepth = code.length - trim.length;
        
        var arr = trim.split("");
        let idx = 0;
        let Tokens : string[] = [];
        let details:  TokeDetails[] = [];
        while(idx < arr.length){
            var result = _symbols.firstPartialMatch(arr, idx);
            if(result == null) {throw "could not lex from: " + arr.slice(idx).join("");}
            var len = result.result.length;
            const token = arr.slice(idx, idx + len).join("");
            if(result.output != eTokenType.comment && result.output != eTokenType.whiteSpace){ // ignoring spaces/comments, etc.
                Tokens.push(token);
            }
            details.push({token, type: result.output, start: idx + TabDepth });
            idx += len;
        }
        return {TabDepth, Tokens, original: code, details};
    }
    public static getTokenAt(tokes: TokeDetails[], index: number): TokeDetails{
        for (const t of tokes) {
            if(index >= t.start && index < t.start + t.token.length)
                return t;
        }
        return null;
    }
}

export interface LexLine{
    TabDepth: number;
    Tokens: string[];
    original: string;
    details: TokeDetails[];
}
export interface TokeDetails{
    token: string;
    type: eTokenType;
    start: number;
}
export enum eTokenType{
    symbol, literalString, literalNumber, comment, identifier, whiteSpace
}

const _symbols = new Syntax<string, eTokenType>()
    .add([whitespace()], eTokenType.whiteSpace)
    .add([tokens(":=",">>","!=", "<=", ">=","<<","::")], eTokenType.symbol)
    .add([tokens("//"), Match.anything(true)], eTokenType.comment)
    .add([symbols("+-=/*!;\\()[],.:<>&|")], eTokenType.symbol)
    .add([number()], eTokenType.literalNumber)
    .add([word()], eTokenType.identifier)
    .add([tokens("\"\"")], eTokenType.literalString) // easier to special case an empty string
    .add(literalString(), eTokenType.literalString)
    .add([tokens("''")], eTokenType.literalString)
    .add(literalStringApostrophe(), eTokenType.literalString)
    .add([tokens("``")], eTokenType.literalString)
    .add(literalStringBacktick(), eTokenType.literalString)
;

function tokens(...matches: string[]):SingleMatch<string> {
    return Match.sequences(matches.map(s => s.split("")));
}

function symbols(symbols: string):SingleMatch<string> {
    return Match.anyOf(symbols.split(""));
}

function whitespace(): SingleMatch<string>{
    return Match.matchWhile(t => t == " " || t == "\t");
}

function word(): SingleMatch<string> {
    return Match.testSequence(t => {
            return !!t.join("").match(/^[$A-Z_][0-9A-Z_$]*$/i);
        }, false,"word");
}
function number(): SingleMatch<string> {
    return Match.testSequence(t => {
        let test = t.join("");
        // this is a bit hacky because the test sequence is greedy
        // we also want a negative to be a unary operator
        // also, don't want 
        if(test[test.length - 1] === ".") return null;
        return !test.includes(" ") && !test.includes("-") && !isNaN(+test) && isFinite(+test);
    }, false, "num");
}
function literalString(): SingleMatch<string>[]{
    return [
        Match.token("\""),
        Match.matchWhileAt((tokes, idx) => {
            return !(tokes[idx] === "\"" && symCountBackwards(tokes, idx -1, "\\") % 2 == 0);
        }),
        Match.token("\"")
    ];
}

function literalStringApostrophe(): SingleMatch<string>[]{
    return [
        Match.token("'"),
        Match.matchWhileAt((tokes, idx) => {
            return !(tokes[idx] === "'" && symCountBackwards(tokes, idx -1, "\\") % 2 == 0);
        }),
        Match.token("'")
    ];
}
function literalStringBacktick(): SingleMatch<string>[]{
    return [
        Match.token("`"),
        Match.matchWhileAt((tokes, idx) => {
            return !(tokes[idx] === "`");
        }),
        Match.token("`")
    ];
}

function symCountBackwards(str: string[], idx:number, symbol: string): number{
    let count = 0;
    for(; idx > 0; idx--){
        if(str[idx] != symbol) break;
        count++;
    }
    return count;
}

