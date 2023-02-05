import { Lexer } from "./Lexer.js";
import { Match, pattern, Syntax } from "./patterns.js";
export class Interpreter {
    static async Process(input, code) {
        let currStep = new Stream(input);
        this.__gen++;
        let currGen = this.__gen;
        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if (step == null)
                return { output: currStep, step: ln - 1 };
            try {
                console.log(":::");
                const next = step.process(currStep);
                currStep = next;
            }
            catch (err) {
                console.log(err);
                return { output: currStep, step: ln };
            }
            await new Promise(f => setTimeout(f, 10));
            if (currGen != this.__gen)
                return null;
        }
        return { output: currStep, step: code.length + 1 };
    }
}
Interpreter.__gen = 0;
export class Stream {
    constructor(text, array, num) {
        this.text = text;
        this.array = array;
        this.num = num;
    }
    toDisplayText(nested) {
        if (this.text) {
            if (nested > 0)
                return "\"" + this.text + "\"";
            return this.text;
        }
        if (this.num)
            return "" + this.num;
        if (this.array)
            return "[\n" + this.array.map(s => " " + s.toDisplayText(nested + 1)).join(",\n") + "\n]";
        return "???";
    }
}
export class Parser {
    static Parse(code) {
        const lines = code.split("\n");
        let context = new ParseContext();
        for (let ln = 0; ln < lines.length; ln++) {
            const code = lines[ln];
            let state = this.ParseLine(code, context);
            context.push(state);
        }
        return context.Statements;
    }
    static ParseLine(code, context) {
        const tokens = Lexer.Tokenize(code);
        let states = [];
        let idx = 0;
        let depth = context.getDepth(tokens.TabDepth);
        while (idx < tokens.Tokens.length) {
            let match = _statements.firstPartialMatch(tokens.Tokens, 0);
            if (match == null)
                return null;
            states.push(match.output(depth, match.result));
            idx = match.result.endIndex + 1;
            if (idx < tokens.Tokens.length && tokens[idx] == ">>")
                idx++;
            //else if (tokens[idx] == )
        }
        let result;
        if (states.length == 0)
            result = null;
        else if (states.length == 1)
            result = states[0];
        else
            result = new SMultiStatement(depth, states);
        return result;
    }
}
class ParseContext {
    constructor() {
        this.Statements = [];
    }
    push(statement) {
        this.Statements.push(statement);
    }
    getScope(tabDepth) {
        if (tabDepth == 0)
            return null;
        for (let index = this.Statements.length - 1; index >= 0; index--) {
            const state = this.Statements[index];
            if (state.tabDepth < tabDepth)
                return state;
        }
        return null;
    }
    getDepth(tabDepth) {
        let count = 0;
        for (let index = this.Statements.length - 1; index >= 0; index--) {
            const state = this.Statements[index];
            if (state.tabDepth < tabDepth) {
                count++;
                tabDepth = state.tabDepth;
            }
        }
        return count;
    }
}
const _statements = new Syntax()
    .add([token("split"), parameterList(true)], (dep, res) => new SSplit(dep, res));
const _expressionComps = new Syntax()
    .add([identifier()], res => new EIdentifier(res))
    .add([literalNumber()], res => new ELiteral(res))
    .add([literalString()], res => new ELiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res));
class IStatement {
    constructor(depth) {
        this.tabDepth = depth;
    }
}
class IExpression {
}
class SIntrinsic {
}
class Expression {
}
class Operator {
}
function token(match) {
    return Match.token(match);
}
function identifier() {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i));
}
function literalNumber() {
    return Match.testToken(t => !isNaN(+t) && isFinite(+t));
}
function literalString() {
    return Match.testToken(t => t[0] === "\""); // shouldn't have lexed anything else with a leading "
}
function expressionLike(stop) {
    return Match.testSequence(tokes => {
        const trail = tokes[token.length - 1];
        if (stop && trail === stop)
            return false;
        const lPars = arrCount(tokes, "(");
        const rPars = arrCount(tokes, ")");
        if (lPars < rPars)
            return false;
        if (lPars > rPars)
            return null;
        return true;
    });
}
function parameterList(optional) {
    return Match.testPattern(pattern(token("("), expressionLike(), token(")")), optional, "params");
}
class SMultiStatement extends IStatement {
    constructor(depth, list) {
        super(depth);
        this.__list = list;
    }
    process(stream) {
        for (let index = 0; index < this.__list.length; index++) {
            const state = this.__list[index];
            stream = state.process(stream);
        }
        return stream;
    }
}
class SSplit extends IStatement {
    constructor(depth, parse) {
        super(depth);
        this.__delim = "\n";
    }
    process(stream) {
        console.log("???");
        if (stream.text === null)
            throw "cannot split stream";
        return new Stream(null, stream.text.split(this.__delim).map(s => new Stream(s)));
    }
}
class EIdentifier extends IExpression {
    constructor(parse) {
        super();
    }
}
class ELiteral extends IExpression {
    constructor(parse) {
        super();
    }
}
class EExpression extends IExpression {
    constructor(parse) { super(); }
}
function arrCount(arr, elem) {
    return arr.map(curr => curr == elem ? 1 : 0).reduce((sum, curr) => sum + curr);
}
//# sourceMappingURL=interpreter.js.map