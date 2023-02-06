import { Lexer } from "./Lexer.js";
import { Match, pattern, Syntax } from "./patterns.js";
export class Interpreter {
    static async Process(input, code) {
        let state = new InterpreterState(input);
        this.__gen++;
        let currGen = this.__gen;
        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if (step == null)
                return { output: state.stream, step: state.line, isComplete: false, error: "could not parse line: " + ln };
            state.line = ln;
            if (step.tabDepth > state.scopeDepth)
                state.pushScope(code[ln - 1]);
            while (state.scopeDepth > step.tabDepth)
                state.popScope();
            try {
                await Interpreter.parallelProcess(state, 0, step);
            }
            catch (err) {
                console.log(err);
                return { output: state.stream, step: state.line, isComplete: false, error: err };
            }
            await new Promise(f => setTimeout(f, 10));
            if (currGen != this.__gen)
                return null;
        }
        return { output: state.stream, step: state.line, isComplete: true };
    }
    static async parallelProcess(state, depth, child) {
        var stack = state.getStack(depth);
        if (depth == state.stackDepth - 1) {
            if (stack.parallellMode) {
                var stream = stack.rawStream.asArray();
                for (let index = 0; index < stream.length; index++) {
                    stack.parallelLine = index;
                    await child.process(state);
                }
            }
            else {
                await child.process(state);
            }
        }
        else if (stack.parallellMode) {
            var stream = stack.rawStream.asArray();
            for (let index = 0; index < stream.length; index++) {
                stack.parallelLine = index;
                await this.parallelProcess(state, depth + 1, child);
            }
        }
        else {
            await this.parallelProcess(state, depth + 1, child);
        }
    }
}
Interpreter.__gen = 0;
export class InterpreterState {
    get stream() { return this.stackLvl.stream; }
    get stackLvl() { return this.__stack[this.__stack.length - 1]; }
    constructor(stream) {
        this.__nest = [];
        this.line = -1;
        this.__stack = [new StackLevel(new Stream(stream), false)];
    }
    updateStream(stream) {
        var stack = this.stackLvl;
        stack.stream = stream;
    }
    // "stack" refers to the data stack, which may or may not correlate to the "scope"
    pushStack(stream, parallel) {
        this.__stack.push(new StackLevel(stream, parallel));
    }
    popStack() {
        return this.__stack.pop().rawStream;
    }
    getStack(idx) {
        return this.__stack[idx];
    }
    get stackDepth() { return this.__stack.length; }
    saveVar(name, value) {
        this.stackLvl.set(name, value);
    }
    get(name) {
        for (let idx = this.__stack.length - 1; idx >= 0; idx--) {
            const obj = this.__stack[idx].get(name);
            if (obj != null)
                return obj;
        }
        return null;
    }
    // "scope" is the statement/tab depth
    pushScope(statement) {
        this.__nest.push(statement);
        statement.onOpenChildScope(this);
    }
    get scopeDepth() { return this.__nest.length; }
    popScope() {
        const pop = this.__nest.pop();
        pop.onCloseChildScope(this);
        return pop;
    }
}
class StackLevel {
    constructor(stream, parallel) {
        this.variables = {};
        this.parallelLine = -1;
        this.__stream = stream;
        this.parallellMode = parallel;
    }
    get(name) {
        if (this.parallellMode)
            return this.variables[name].asArray()[this.parallelLine];
        return this.variables[name];
    }
    set(name, value) {
        if (this.parallellMode) {
            if (this.variables[name] == null)
                this.variables[name] = Stream.mkArr([]);
            this.variables[name].asArray()[this.parallelLine] = value;
        }
        else
            this.variables[name] = value;
    }
    get stream() {
        if (this.parallellMode) {
            return this.__stream.asArray()[this.parallelLine];
        }
        return this.__stream;
    }
    set stream(stream) {
        if (this.parallellMode) {
            this.__stream.asArray()[this.parallelLine] = stream;
        }
        else {
            this.__stream = stream;
        }
    }
    get rawStream() { return this.__stream; }
}
export var eStreamType;
(function (eStreamType) {
    eStreamType[eStreamType["Text"] = 0] = "Text";
    eStreamType[eStreamType["Num"] = 1] = "Num";
    eStreamType[eStreamType["Bool"] = 2] = "Bool";
    eStreamType[eStreamType["Array"] = 3] = "Array";
})(eStreamType || (eStreamType = {}));
export class Stream {
    constructor(text, array, num, bool) {
        this.text = text;
        this.array = array;
        this.num = num;
        this.bool = bool;
    }
    static mkText(text) { return new Stream(text); }
    static mkArr(arr) { return new Stream(null, arr); }
    static mkNum(num) { return new Stream(null, null, num); }
    static mkBool(bool) { return new Stream(null, null, null, bool); }
    copy() {
        return new Stream(this.text, this.array?.slice(), this.num, this.bool);
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
            return "[\n" + this.array.map(s => " " + s.toDisplayText((nested ?? 0) + 1)).join(",\n") + "\n]";
        return "???";
    }
    static areEqual(a, b) {
        if (a.text != null)
            return a.text === b.text;
        if (a.num != null)
            return a.num === b.num;
        if (a.bool != null)
            return a.bool === b.bool;
        if (a.array != null)
            throw 'array comparison not implemented';
        throw "couldn't compare null object?";
    }
    static areSameType(a, b) {
        return a.type == b.type;
    }
    get type() {
        if (this.text !== null)
            return eStreamType.Text;
        if (this.num !== null)
            return eStreamType.Num;
        if (this.bool !== null)
            return eStreamType.Bool;
        if (this.array !== null)
            return eStreamType.Array;
        throw 'unknown type';
    }
    canCastTo(type) {
        switch (type) {
            case eStreamType.Array: return [eStreamType.Array].includes(type);
            case eStreamType.Bool: return [eStreamType.Bool, eStreamType.Num].includes(type);
            case eStreamType.Num: return [eStreamType.Num].includes(type);
            case eStreamType.Text: return [eStreamType.Text, eStreamType.Num, eStreamType.Bool].includes(type);
            default: throw 'type not implemented for canCast';
        }
    }
    runOp(op, other) {
        switch (op) {
            case "=": return new Stream(null, null, null, Stream.areEqual(this, other));
            case "!=": return new Stream(null, null, null, !Stream.areEqual(this, other));
            case "+":
                if (!other.canCastTo(this.type))
                    throw 'could not cast right side for +';
                switch (this.type) {
                    case eStreamType.Num: return Stream.mkNum(this.num + other.asNum());
                    case eStreamType.Text: return Stream.mkText(this.text + other.asString());
                    case eStreamType.Array: return Stream.mkArr([].concat(this.array, other.asArray()));
                    default: throw 'types not compatible for +';
                }
            default: throw 'operator ' + op + ' is not implemented';
        }
    }
    toRaw() {
        return this.text ?? this.num ?? this.bool ?? this.array;
    }
    asNum() {
        if (this.num !== null)
            return this.num;
        throw 'cannot cast to number';
    }
    asString() {
        if (this.text !== null)
            return this.text;
        if (this.num !== null)
            return "" + this.num;
        if (this.bool !== null)
            return "" + this.bool;
        throw 'cannot cast to number';
    }
    asBool() {
        if (this.bool !== null)
            return this.bool;
        if (this.num !== null)
            return this.num != 0;
        throw 'cannot cast to number';
    }
    asArray() {
        if (this.array !== null)
            return this.array; // caution! original reference!
        throw 'cannot cast to number';
    }
    get isNum() { return this.isNum !== null; }
    get isText() { return this.text !== null; }
    get isBool() { return this.bool !== null; }
    get isArray() { return this.array !== null; }
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
        if (tokens.Tokens.length == 0)
            return new SNoop(tokens.TabDepth);
        while (idx < tokens.Tokens.length) {
            let match = _statements.firstPartialMatch(tokens.Tokens, idx);
            if (match == null)
                return null;
            states.push(match.output(depth, match.result));
            idx = match.result.endIndex + 1;
            if (idx < tokens.Tokens.length && tokens[idx] == ">>")
                idx++;
            else if (idx < tokens.Tokens.length)
                return null;
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
    static tryParseParamList(parse, key) {
        let tokes = parse?.tryGetByKey(key ?? "params");
        if (tokes == null)
            return null;
        return this.tryParseExpressions(tokes.slice(1, -1));
    }
    // null is valid, but a buggy expresison will throw
    static tryParseExpressions(tokens) {
        let outputs = [];
        let idx = 0;
        let stack = [];
        let ops = [];
        while (true) {
            let match = _expressionComps.firstPartialMatch(tokens, idx);
            if (match == null)
                return null;
            stack.push(match.output(match.result));
            idx = match.result.endIndex + 1;
            if (idx >= tokens.length || tokens[idx] == ",") {
                idx++;
                if (stack.length == 1) {
                    outputs.push(stack[0]);
                }
                else {
                    outputs.push(EOperator.SplitEquation(stack, ops));
                }
                stack = [];
                ops = [];
                if (idx >= tokens.length)
                    break;
            }
            else if (EOperator.IsOperator(tokens[idx])) {
                ops.push(tokens[idx]);
                idx++;
                if (idx >= tokens.length)
                    throw 'expected expression to continue';
            }
            else
                throw 'unexpected symbol ' + tokens[idx];
        }
        return outputs;
    }
    static tryParseExpression(tokens) {
        let arr = this.tryParseExpressions(tokens);
        if (!arr || arr.length != 1)
            return null;
        return arr[0];
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
            if (!state)
                return count;
            if (state.tabDepth < tabDepth) {
                count++;
                tabDepth = state.tabDepth;
            }
        }
        return count;
    }
}
const _statements = new Syntax()
    .add([token("split"), parameterList(true)], (dep, res) => new SSplit(dep, res))
    .add([token("join"), parameterList(true)], (dep, res) => new SJoin(dep, res))
    .add([token("replace"), parameterList(false)], (dep, res) => new SReplace(dep, res))
    .add([token("map")], (dep, res) => new SMap(dep))
    .add([token("filter")], (dep, res) => new SFilter(dep))
    .add([token("contains"), parameterList(false)], (dep, res) => new SContains(dep, res))
    .add([token("piece"), parameterList(false)], (dep, res) => new SPiece(dep, res));
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax()
    .add([identifier()], res => new EIdentifier(res))
    .add([literalNumber()], res => new ENumericLiteral(res))
    .add([literalString()], res => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res));
class IStatement {
    constructor(depth) {
        this.tabDepth = depth;
    }
    onOpenChildScope(state) { throw ''; } // do these need to be parallel? probably not
    onCloseChildScope(state) { }
}
class IExpression {
    async EvalAsText(state) {
        let out = await this.Eval(state);
        if (out.text == null)
            throw 'expected expression to evaluate as string, got ' + out.toDisplayText();
        return out.text;
    }
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
    }, false, "exp");
}
function parameterList(optional) {
    return Match.testPattern(pattern(token("("), expressionLike(), token(")")), optional, "params");
}
class SMultiStatement extends IStatement {
    constructor(depth, list) {
        super(depth);
        this.__list = list;
    }
    async process(state) {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            await substate.process(state);
        }
    }
}
class SMap extends IStatement {
    constructor(depth) {
        super(depth);
    }
    async process(state) {
        if (!state.stream.isArray)
            throw 'map function expected to process an array';
    }
    onOpenChildScope(state) {
        state.pushStack(state.stream.copy(), true);
    }
    onCloseChildScope(state) {
        state.updateStream(state.popStack());
    }
}
class SFilter extends IStatement {
    constructor(depth) {
        super(depth);
    }
    async process(state) {
        if (!state.stream.isArray)
            throw 'map function expected to process an array';
    }
    onOpenChildScope(state) {
        state.pushStack(state.stream.copy(), true);
    }
    onCloseChildScope(state) {
        const result = state.popStack().asArray();
        const prev = state.stream.asArray();
        const filtered = prev.filter((v, i) => result[i].asBool());
        state.updateStream(Stream.mkArr(filtered));
    }
}
class SSplit extends IStatement {
    constructor(depth, parse) {
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if (assertParams(pars, 0, 1))
            this.__exp = pars[0];
    }
    async process(state) {
        if (state.stream.text === null)
            throw "cannot split stream - expected string";
        let delim = "\n";
        if (this.__exp)
            delim = await this.__exp.EvalAsText(state);
        state.updateStream(new Stream(null, state.stream.text.split(delim).map(s => new Stream(s))));
    }
}
class SNoop extends IStatement {
    constructor(depth) { super(depth); }
    async process(state) { }
}
class SJoin extends IStatement {
    constructor(depth, parse) {
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if (assertParams(pars, 0, 1))
            this.__exp = pars[0];
    }
    async process(state) {
        if (state.stream.array === null)
            throw "cannot join stream - expected array";
        let delim = "\n";
        if (this.__exp)
            delim = await this.__exp.EvalAsText(state);
        state.updateStream(Stream.mkText(state.stream.array.map(s => s.asString()).join(delim)));
    }
}
class SReplace extends IStatement {
    constructor(depth, parse) {
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if (assertParams(pars, 2, 2)) {
            this.__target = pars[0];
            this.__replacement = pars[1];
        }
    }
    async process(state) {
        if (!state.stream.isText)
            throw "cannot replace stream - expected string";
        let target = await this.__target.Eval(state);
        let replace = await this.__replacement.Eval(state);
        state.updateStream(Stream.mkText(state.stream.text.replaceAll(target.asString(), replace.asString())));
    }
}
class SContains extends IStatement {
    constructor(depth, parse) {
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if (assertParams(pars, 1, 1))
            this.__target = pars[0];
    }
    async process(state) {
        if (!state.stream.isText)
            throw "cannot replace stream - expected string";
        let target = await this.__target.Eval(state);
        state.updateStream(Stream.mkBool(state.stream.text.includes(target.asString())));
    }
}
class SPiece extends IStatement {
    constructor(depth, parse) {
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if (assertParams(pars, 2, 2)) {
            this.__delim = pars[0];
            this.__idx = pars[1];
        }
    }
    async process(state) {
        if (!state.stream.isText)
            throw "cannot replace stream - expected string";
        const orig = state.stream.asString();
        const target = await (await this.__delim.Eval(state)).asString();
        const idx = await (await this.__idx.Eval(state)).asNum();
        const split = orig.split(target);
        state.updateStream(Stream.mkText(split[idx - 1]));
    }
}
class EIdentifier extends IExpression {
    constructor(parse) {
        super();
    }
    async Eval(state) {
        throw '';
    }
}
class ENumericLiteral extends IExpression {
    constructor(parse) {
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    async Eval(state) {
        return new Stream(null, null, this.__num);
    }
}
class EStringLiteral extends IExpression {
    constructor(parse) {
        super();
        const str = parse.PullOnlyResult();
        // this seems like something where there should be a better way...
        this.__str = JSON.parse(str); // str.substring(1, str.length - 1).replace();
    }
    async Eval(state) {
        return new Stream(this.__str);
    }
}
class EExpression extends IExpression {
    constructor(parse) {
        super();
        let tokes = parse.tryGetByKey("exp");
        this.__inner = Parser.tryParseExpression(tokes);
    }
    async Eval(state) {
        return this.__inner.Eval(state);
    }
}
class EOperator extends IExpression {
    constructor(left, op, right) {
        super();
        this.__left = left;
        this.__right = right;
        this.__op = op;
    }
    static SplitEquation(stack, ops) {
        let opIdx = ops.map((o, i) => i);
        opIdx.sort((a, b) => {
            // sorts higher operators to later
            if (a === b)
                return 0; // shouldn't happen?
            const aa = EOperator.OpPriority(ops[a]);
            const bb = EOperator.OpPriority(ops[b]);
            if (aa == bb)
                return (a > b) ? 1 : -1;
            if (aa > bb)
                return 1;
            if (aa < bb)
                return -1;
            throw 'unreachable';
        });
        for (const idx of opIdx) {
            const newOp = new EOperator(stack[idx], ops[idx], stack[idx + 1]);
            stack[idx] = newOp;
            stack[idx + 1] = newOp;
        }
        // all the expressions in the stack should now point to the same operation
        return stack[0];
    }
    async Eval(state) {
        const a = await this.__left.Eval(state);
        const b = await this.__right.Eval(state);
        return a.runOp(this.__op, b);
    }
    static IsOperator(op) {
        switch (op) {
            case "!=":
                return true;
            default: return "+-=*/&|<>".includes(op);
        }
    }
    static OpPriority(op) {
        // higher means later
        switch (op) {
            case ".": return 1;
            case "*":
            case "/":
                return 2;
            case "+":
            case "-":
                return 3;
            case "=":
            case "!=":
            case "<":
            case ">":
            case "<=":
            case ">=":
                return 4;
            case "&":
            case "|":
                return 4;
            default: throw 'operator does not have priority?';
        }
    }
}
function arrCount(arr, elem) {
    return arr.map(curr => curr == elem ? 1 : 0).reduce((sum, curr) => sum + curr);
}
function assertParams(pars, min, max) {
    let len = pars?.length ?? 0;
    if (len < min)
        throw 'function requires parameters';
    if (len > max)
        throw 'too many parameters for function';
    return len > 0;
}
//# sourceMappingURL=interpreter.js.map