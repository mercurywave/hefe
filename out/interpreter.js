import { Lexer } from "./Lexer.js";
import { Match, pattern, Syntax } from "./patterns.js";
export class Interpreter {
    static async Process(input, code) {
        let state = new InterpreterState(input.text);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        this.__gen++;
        let currGen = this.__gen;
        let lastScope = null;
        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if (step instanceof SNoop)
                continue;
            console.log("------" + ln);
            if (step == null)
                return { output: state.exportAsStream(), step: state.line, isComplete: false, error: "could not parse line: " + ln };
            state.line = ln;
            if (step.tabDepth + 1 > state.depth && lastScope)
                state.pushStack(lastScope);
            while (state.depth > step.tabDepth + 1)
                state.popStack();
            if (step instanceof SExit)
                break;
            try {
                await Interpreter.parallelProcess(state, 0, step);
            }
            catch (err) {
                console.log(err);
                return { output: state.exportAsStream(), step: state.line, isComplete: false, error: err };
            }
            lastScope = step;
            await new Promise(f => setTimeout(f, 1));
            if (currGen != this.__gen)
                return null;
        }
        return { output: state.exportAsStream(), step: state.line, isComplete: true };
    }
    static async parallelProcess(state, depth, child) {
        let futures = [];
        state.foreachExecution(context => futures.push(child.process(context)));
        await Promise.all(futures);
    }
}
Interpreter.__gen = 0;
export class ExecutionContext {
    constructor(currBranch, state) {
        this.__currBranch = currBranch;
        this.__state = state;
    }
    get stream() { return this.leafNode.stream; }
    get leafNode() { return this.__currBranch[this.__currBranch.length - 1]; }
    updateStream(stream) {
        var stack = this.leafNode;
        stack.stream = stream;
    }
    saveVar(name, value) {
        this.leafNode.set(name, value);
    }
    get(name) {
        for (let idx = this.__currBranch.length - 1; idx >= 0; idx--) {
            const obj = this.__currBranch[idx].get(name);
            if (obj != null)
                return obj;
        }
        return null;
    }
}
export class InterpreterState {
    constructor(stream) {
        this.__scopes = [null];
        this.line = -1;
        this.__root = new StackBranch(Stream.mkText(stream), 0);
    }
    get depth() { return this.__scopes.length; }
    foreachExecution(action, depth) {
        this.foreachChain((c) => action(new ExecutionContext(c, this)));
    }
    foreachChain(action, depth) {
        this.chainIterHelper(action, this.__root, [this.__root], depth ?? (this.depth - 1));
    }
    chainIterHelper(action, node, chain, depth) {
        if (depth == 0) {
            action(chain, node);
        }
        else {
            for (const branch of node.__branches) {
                this.chainIterHelper(action, branch, chain.slice().concat(branch), depth - 1);
            }
        }
    }
    pushStack(state) {
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const streams = state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        });
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    popStack() {
        let owner = this.__scopes.pop();
        // since we popped, the leafs have branches
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const branches = leaf.branches.map(b => b.stream);
            owner.onCloseChildScope(context, branches);
            leaf.branches = null;
        });
    }
    exportAsStream() {
        if (this.depth == 1)
            return this.__root.stream;
        let streams = [];
        this.foreachChain((c, l) => streams.push(l.stream));
        if (streams.length == 1)
            return streams[0];
        return Stream.mkArr(streams);
    }
    setGlobalVal(name, value) {
        this.__root.set(name, value);
    }
}
class StackBranch {
    constructor(stream, index) {
        this.variables = {};
        this.__stream = stream;
        this.index = index;
    }
    get(name) {
        return this.variables[name];
    }
    set(name, value) {
        this.variables[name] = value;
    }
    get stream() { return this.__stream; }
    set stream(stream) { this.__stream = stream; }
    set branches(leafs) { this.__branches = leafs; }
    get branches() { return this.__branches; }
    addBranch(leaf) {
        if (this.__branches == null)
            this.__branches = [];
        this.__branches.push(leaf);
    }
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
        this.text = text ?? null;
        this.array = array ?? null;
        this.num = num ?? null;
        this.bool = bool ?? null;
    }
    static mkText(text) { return new Stream(text); }
    static mkArr(arr) { return new Stream(null, arr); }
    static mkNum(num) { return new Stream(null, null, num); }
    static mkBool(bool) { return new Stream(null, null, null, bool); }
    copy() {
        return new Stream(this.text, this.array?.slice(), this.num, this.bool);
    }
    toDisplayText(nested) {
        if (this.isText) {
            if (nested > 0)
                return "\"" + this.text + "\"";
            return this.text;
        }
        if (this.isNum)
            return "" + this.num;
        if (this.isBool)
            return "" + this.bool;
        if (this.isArray)
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
            case "|": return Stream.mkBool(this.asBool() || other.asBool());
            case "&": return Stream.mkBool(this.asBool() && other.asBool());
            case "<": return Stream.mkBool(this.asNum() < other.asNum());
            case ">": return Stream.mkBool(this.asNum() > other.asNum());
            case "<=": return Stream.mkBool(this.asNum() <= other.asNum());
            case ">=": return Stream.mkBool(this.asNum() >= other.asNum());
            case "+":
                if (!other.canCastTo(this.type))
                    throw 'could not cast right side for +';
                switch (this.type) {
                    case eStreamType.Num: return Stream.mkNum(this.num + other.asNum());
                    case eStreamType.Text: return Stream.mkText(this.text + other.asString());
                    case eStreamType.Array: return Stream.mkArr([].concat(this.array, other.asArray()));
                    default: throw 'types not compatible for +';
                }
            case "-": return Stream.mkNum(this.asNum() - other.asNum());
            case "*": return Stream.mkNum(this.asNum() * other.asNum());
            case "/": return Stream.mkNum(this.asNum() / other.asNum());
            default: throw 'operator ' + op + ' is not implemented';
        }
    }
    runUnary(op) {
        switch (op) {
            case "!": return Stream.mkBool(this.asBool());
            case "-": return Stream.mkNum(-this.asNum());
            default: throw `unary not implemented ${op}`;
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
    get isNum() { return this.num !== null; }
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
        let depth = context.getDepth(tokens.TabDepth);
        if (tokens.Tokens.length == 0)
            return new SNoop(tokens.TabDepth);
        return this.ParseStatements(tokens.Tokens, depth);
    }
    static ParseStatements(tokens, depth) {
        let idx = 0;
        let states = [];
        while (idx < tokens.length) {
            let match = _statements.firstPartialMatch(tokens, idx);
            if (match == null)
                return null;
            states.push(match.output(depth, match.result));
            idx = match.result.endIndex + 1;
            if (idx < tokens.length && tokens[idx] == ">>")
                idx++;
            else if (idx < tokens.length)
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
    .add([token("map")], (dep, res) => new SMap(dep))
    .add([token("filter")], (dep, res) => new SFilter(dep))
    .add([token("exit")], (dep, res) => new SExit(dep))
    .add([identifier(), token("<<"), Match.anything()], (dep, res) => new SStoreLocal(dep, res))
    .add([expressionLike(">>")], (dep, res) => new SExpression(dep, res));
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax()
    .add([identifier(), parameterList(false)], res => new EFunctionCall(res))
    .add([token("stream")], res => new EStream())
    .add([token("index")], res => new EIndex())
    .add([identifier()], res => new EIdentifier(res))
    .add([unary(), expressionLike()], res => new EUnary(res))
    .add([literalNumber()], res => new ENumericLiteral(res))
    .add([literalString()], res => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res));
class IStatement {
    constructor(depth) {
        this.tabDepth = depth;
    }
    onOpenChildScope(context) { throw 'statement does not support child scopes'; }
    onCloseChildScope(context, streams) { }
}
class IExpression {
    async EvalAsText(context) {
        let out = await this.Eval(context);
        if (out.text == null)
            throw 'expected expression to evaluate as string, got ' + out.toDisplayText();
        return out.text;
    }
    async EvalAsMethod(context, stream) { throw 'expression is not a method'; }
}
function token(match) {
    return Match.token(match);
}
function unary() {
    return Match.anyOf(["!", "-"], false, "unary");
}
function identifier() {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i), false, "ident");
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
    async process(context) {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            await substate.process(context);
        }
    }
}
class SExit extends IStatement {
    constructor(depth) { super(depth); }
    async process(context) { }
}
class SMap extends IStatement {
    constructor(depth) {
        super(depth);
    }
    async process(context) {
        if (!context.stream.isArray)
            throw 'map function expected to process an array';
    }
    onOpenChildScope(context) {
        return context.stream.asArray().slice();
    }
    onCloseChildScope(context, streams) {
        context.updateStream(Stream.mkArr(streams));
    }
}
class SFilter extends IStatement {
    constructor(depth) {
        super(depth);
    }
    async process(context) {
        if (!context.stream.isArray)
            throw 'map function expected to process an array';
    }
    onOpenChildScope(context) {
        return context.stream.asArray().slice();
    }
    onCloseChildScope(context, streams) {
        const prev = context.stream.asArray();
        const filtered = prev.filter((v, i) => streams[i].asBool());
        context.updateStream(Stream.mkArr(filtered));
    }
}
class SStoreLocal extends IStatement {
    constructor(depth, parse) {
        super(depth);
        this.__ident = parse.getSingleKey("ident");
        this.__exp = Parser.tryParseExpression(parse.tryGetByKey("any"));
    }
    async process(context) {
        const result = await this.__exp.Eval(context);
        context.saveVar(this.__ident, result);
    }
}
class SExpression extends IStatement {
    constructor(depth, parse) {
        super(depth);
        this.__exp = Parser.tryParseExpression(parse.GetSlice());
    }
    async process(context) {
        const result = await this.__exp.Eval(context);
        context.updateStream(result);
    }
}
class SNoop extends IStatement {
    constructor(depth) { super(depth); }
    async process(context) { }
}
class EIdentifier extends IExpression {
    constructor(parse) {
        super();
        this.name = parse.getSingleKey("ident");
    }
    async Eval(context) {
        let func = _builtInFuncs[this.name];
        if (func != null) {
            return await EFunctionCall.runFunc(this.name, [], context, context.stream);
        }
        let obj = context.get(this.name);
        if (obj == null)
            throw `unknown variable "${this.name}"`;
        return obj;
    }
    async EvalAsMethod(context, stream) {
        let func = _builtInFuncs[this.name];
        if (func != null) {
            return await EFunctionCall.runFunc(this.name, [], context, stream);
        }
    }
}
class EStream extends IExpression {
    constructor() { super(); }
    async Eval(context) { return context.stream; }
}
class EIndex extends IExpression {
    constructor() { super(); }
    async Eval(context) { return Stream.mkNum(context.leafNode.index); }
}
class ENumericLiteral extends IExpression {
    constructor(parse) {
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    async Eval(context) {
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
    async Eval(context) {
        return new Stream(this.__str);
    }
}
class EExpression extends IExpression {
    constructor(parse) {
        super();
        let tokes = parse.tryGetByKey("exp");
        this.__inner = Parser.tryParseExpression(tokes);
    }
    async Eval(context) {
        return this.__inner.Eval(context);
    }
}
class EUnary extends IExpression {
    constructor(parse) {
        super();
        this.__right = Parser.tryParseExpression(parse.tryGetByKey("exp"));
        this.__op = parse.getSingleKey("unary");
    }
    async Eval(context) {
        const a = await this.__right.Eval(context);
        return a.runUnary(this.__op);
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
        return stack[opIdx[opIdx.length - 1]];
    }
    async Eval(context) {
        const a = await this.__left.Eval(context);
        if (this.__op == ":") {
            return await this.__right.EvalAsMethod(context, a);
        }
        const b = await this.__right.Eval(context);
        return a.runOp(this.__op, b);
    }
    static IsOperator(op) {
        switch (op) {
            case "!=":
                return true;
            default: return "+-=*/&|<>.:".includes(op);
        }
    }
    static OpPriority(op) {
        // higher means later
        switch (op) {
            case ".":
            case ":":
                return 1;
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
class EFunctionCall extends IExpression {
    constructor(parse) {
        super();
        this.name = parse.getSingleKey("ident");
        this.params = Parser.tryParseParamList(parse);
    }
    async Eval(context) {
        return EFunctionCall.runFunc(this.name, this.params, context, context.stream);
    }
    static async runFunc(name, params, context, stream) {
        let func = _builtInFuncs[name];
        if (func == null)
            throw 'could not find function ' + name;
        if (params.length < func.minP || params.length > func.maxP)
            throw `${name} expected ${func.minP}-${func.maxP} params, got ${params.length}`;
        return await func.action(context, stream, params);
    }
    async EvalAsMethod(context, stream) {
        return await EFunctionCall.runFunc(this.name, this.params, context, stream);
    }
}
const _builtInFuncs = {};
regFunc("split", 0, 1, async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot split stream - expected string";
    let delim = "\n";
    if (pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkArr(stream.text.split(delim).map(s => new Stream(s)));
});
regFunc("join", 0, 1, async (c, stream, pars) => {
    if (!stream.isArray)
        throw "cannot join stream - expected array";
    let delim = "\n";
    if (pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkText(stream.array.map(s => s.asString()).join(delim));
});
regFunc("concat", 1, 1, async (c, stream, pars) => {
    if (!stream.isArray)
        throw "cannot concat stream - expected array";
    let tail = (await pars[0].Eval(c)).asArray();
    return Stream.mkArr(stream.array.concat(tail));
});
regFunc("replace", 2, 2, async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot replace in stream - expected string";
    const target = await pars[0].EvalAsText(c);
    const replace = await pars[1].EvalAsText(c);
    return Stream.mkText(stream.text.replaceAll(target, replace));
});
regFunc("piece", 2, 2, async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot piece stream - expected string";
    const delim = await pars[0].EvalAsText(c);
    const idx = (await pars[1].Eval(c)).asNum();
    const split = stream.asString().split(delim);
    return Stream.mkText(split[idx - 1]);
});
regFunc("contains", 1, 1, async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot check stream for substring contains - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.includes(target));
});
regFunc("modulo", 1, 1, async (c, stream, pars) => {
    if (!stream.isNum)
        throw "cannot modulo stream - expected number";
    const m = (await pars[0].Eval(c)).asNum();
    return Stream.mkNum(((stream.num % m) + m) % m);
});
regFunc("slice", 1, 2, async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot slice stream - expected string"; // TODO: apply to arrays
    const start = (await pars[0].Eval(c)).asNum();
    let end = null;
    if (pars.length > 1)
        end = (await pars[1].Eval(c)).asNum();
    return Stream.mkText(stream.asString().slice(start, end));
});
regFunc("iif", 2, 3, async (c, stream, pars) => {
    const test = (await pars[0].Eval(c)).asBool();
    if (test) {
        return await pars[1].Eval(c);
    }
    if (pars.length > 2)
        return await pars[2].Eval(c);
    return stream;
});
function regFunc(name, minP, maxP, action) {
    _builtInFuncs[name] = mkFunc(name, minP, maxP, action);
}
function mkFunc(name, minP, maxP, action) {
    return { name, minP, maxP, action };
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