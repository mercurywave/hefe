import { Interpreter } from "./interpreter.js";
import { Lexer } from "./Lexer.js";
import { Match, pattern, Syntax } from "./patterns.js";
import { Stream } from "./stream.js";
export class Parser {
    static Parse(code) {
        const lines = code.split("\n");
        let context = new ParseContext();
        for (let ln = 0; ln < lines.length; ln++) {
            const code = lines[ln];
            let state = this.ParseLine(context, code);
            if (state)
                state.fileLine = ln;
            context.push(state);
        }
        return context;
    }
    static ParseLine(context, code) {
        const tokens = Lexer.Tokenize(code);
        context.prepNewLine(tokens);
        if (tokens.Tokens.length == 0)
            return new SNoop(context);
        return this.ParseStatements(context, tokens.Tokens);
    }
    static ParseStatements(context, tokens) {
        let idx = 0;
        let states = [];
        while (idx < tokens.length) {
            let match = _statements.firstPartialMatch(tokens, idx);
            if (match == null)
                return null;
            states.push(match.output(context, match.result));
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
            result = new SMultiStatement(context, states);
        return result;
    }
    static tryParseParamList(context, parse, key) {
        let tokes = parse?.tryGetByKey(key ?? "params");
        if (tokes == null)
            return [];
        return Parser.tryParseExpressions(context, tokes.slice(1, -1));
    }
    // null is valid, but a buggy expresison will throw
    static tryParseExpressions(context, tokens) {
        let outputs = [];
        let idx = 0;
        let stack = [];
        let ops = [];
        while (true) {
            let match = _expressionComps.firstPartialMatch(tokens, idx);
            if (match == null)
                return null;
            stack.push(match.output(context, match.result));
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
    static tryParseExpression(context, tokens) {
        let arr = this.tryParseExpressions(context, tokens);
        if (!arr || arr.length != 1)
            return null;
        return arr[0];
    }
    static getBuiltInsSymbols() {
        var list = [];
        for (const func of Object.values(_builtInFuncs)) {
            list.push({
                symbol: func.name + (func.minP > 0 ? "(" : ""),
                display: this.getFuncDisplay(func)
            });
        }
        for (const ident of _keywordStatements) {
            list.push({
                symbol: ident,
                display: ident
            });
        }
        return list;
    }
    static getFuncDisplay(func) {
        let params = func.params.map((v, i) => v + (i >= func.minP ? "?" : ""));
        return `${func.name}(${params.join(", ")})`;
    }
}
export class ParseContext {
    constructor() {
        this.Statements = [];
        this.currLineDepth = 0;
        this.functionDefs = {};
        this.identifiers = new Set();
        this._parseStateFunc = null;
    }
    push(statement) {
        if (this._parseStateFunc) {
            statement.tabDepth--;
            this._parseStateFunc.registerChildLine(statement);
        }
        else if (statement instanceof SFunctionDef) {
            this.registerFunction(statement);
        }
        else {
            this.Statements.push(statement);
        }
    }
    prepNewLine(lex) {
        if (lex.TabDepth == 0)
            this._parseStateFunc = null;
        this.currLineDepth = this.getDepth(lex.TabDepth);
    }
    registerIdent(ident) { this.identifiers.add(ident); }
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
    registerFunction(func) {
        this._parseStateFunc = func;
        this.functionDefs[func.name] = func;
        for (const p of func.params) {
            this.registerIdent(p);
        }
    }
}
const _keywordStatements = ["map", "filter",
    "sortBy", "sumBy", "exit", "stream",
    "index", "true", "false", "pivot", "function"];
const _scopeStatements = new Syntax()
    .addAnyOf(scopeStatement("sortBy"), (con, res) => new SSortBy(con, res))
    .addAnyOf(scopeStatement("sumBy"), (con, res) => new SSumBy(con, res))
    .addAnyOf(scopeStatement("map"), (con, res) => new SMap(con, res))
    .addAnyOf(scopeStatement("filter"), (con, res) => new SFilter(con, res))
    .addAnyOf(scopeStatement("pivot"), (con, res) => new SPivot(con, res))
    .addAnyOf(scopeStatement("do"), (con, res) => new SDo(con, res));
const _statements = new Syntax()
    .addMulti(_scopeStatements)
    .add([token("exit")], (con, res) => new SExit(con))
    .add([identifier(), token("<<"), scopeStatementLike()], (con, res) => new SStoreLocalScoped(con, res))
    .add([identifier(), token("<<"), Match.anything()], (con, res) => new SStoreLocal(con, res))
    .add([token("function"), identifier("fn"), parameterDefList()], (con, res) => new SFunctionDef(con, res))
    .add([token("function"), identifier("fn")], (con, res) => new SFunctionDef(con, res))
    .add([expressionLike(">>")], (con, res) => new SExpression(con, res));
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax()
    .add([identifier(), token("("), token(")")], (con, res) => new EFunctionCall(con, res))
    .add([identifier(), parameterList(false)], (con, res) => new EFunctionCall(con, res))
    .add([token("stream")], res => new EStream())
    .add([token("index")], res => new EIndex())
    .add([token("true")], res => new ETrueLiteral())
    .add([token("false")], res => new EFalseLiteral())
    .add([identifier()], (con, res) => new EIdentifier(res))
    .add([unary(), expressionLike()], (con, res) => new EUnary(con, res))
    .add([literalNumber()], (con, res) => new ENumericLiteral(res))
    .add([literalString()], (con, res) => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], (con, res) => new EExpression(con, res))
    .add([token("["), token("]")], (con, res) => new EArrayDef(con, res))
    .add([token("["), expressionLike(), token("]")], (con, res) => new EArrayDef(con, res));
export class IStatement {
    constructor(context) {
        this.tabDepth = context.currLineDepth;
    }
}
export class ICanHaveScope extends IStatement {
}
export class SScopeFunction extends ICanHaveScope {
    constructor(context, res) {
        super(context);
        this.__preExp = null;
        this.__postExp = null;
        let pre = res.tryGetByKey("pre");
        let post = res.tryGetByKey("post");
        if (pre)
            this.__preExp = Parser.tryParseExpression(context, pre);
        if (post)
            this.__postExp = Parser.tryParseExpression(context, post);
    }
    async process(context) {
        context.scratch = await this.__preExp?.Eval(context, context.stream) ?? context.stream;
        await this.__onProcess(context, context.scratch);
    }
    async onOpenChildScope(context) {
        return await this.__onOpenChildScope(context, context.scratch);
    }
    async onCloseChildScope(context, streams) {
        let scratch = await this.__onCloseChildScope(context, streams);
        if (!this.__postExp) {
            return scratch;
        }
        return await this.__postExp.Eval(context, scratch);
    }
}
class IExpression {
    async EvalAsText(context) {
        let out = await this.Eval(context, context.stream);
        if (out.text == null)
            throw 'expected expression to evaluate as string, got ' + out.toDisplayText();
        return out.text;
    }
}
function token(match, optional) {
    return Match.token(match, optional);
}
function debugToken() {
    return Match.debugMatch();
}
function unary() {
    return Match.anyOf(["!", "-"], false, "unary");
}
function identifier(key) {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i), false, key ?? "ident");
}
function isIdentifier(s) {
    return s.match(/^[$A-Z_][0-9A-Z_$]*$/i) !== null;
}
function literalNumber() {
    return Match.testToken(t => !isNaN(+t) && isFinite(+t));
}
function literalString() {
    return Match.testToken(t => t[0] === "\""); // shouldn't have lexed anything else with a leading "
}
function scopeStatementLike() {
    return Match.testRemainder(t => {
        let test = _scopeStatements.firstPartialMatch(t, 0);
        return test?.result.length == t.length;
    }, false, "statement");
}
function scopeStatement(func) {
    const splitter = "::";
    return [
        [
            token(func),
            debugToken(),
            token(splitter),
            expressionLike(null, false, "post"),
        ],
        [token(func)],
        [
            expressionLike(splitter, false, "pre"),
            token(splitter),
            token(func),
            token(splitter),
            expressionLike(null, false, "post"),
        ],
        [
            expressionLike(splitter, true, "pre"),
            token(splitter, true),
            token(func)
        ],
    ];
}
function expressionLike(stop, optional, key) {
    return Match.testSequence(tokes => {
        const trail = tokes[token.length - 1];
        if (stop && trail === stop)
            return false;
        const lPars = arrCount(tokes, "(", "[");
        const rPars = arrCount(tokes, ")", "]");
        if (lPars < rPars)
            return false;
        if (lPars > rPars)
            return null;
        return true;
    }, optional, key ?? "exp");
}
function parameterList(optional) {
    return Match.testPattern(pattern(token("("), expressionLike(null, true), // this doesn't seem to actually be optional?
    token(")")), optional, "params");
}
function parameterDefList(key) {
    return Match.testSequence(tokes => {
        if (tokes.length == 0)
            return null; // do I really need to handle this here?
        if (tokes[0] !== "(")
            return false;
        if (tokes[token.length - 1] === ")")
            return true;
        for (let i = 1; i < tokes.length - 1; i++) {
            const element = tokes[i];
            if (i % 2 === 1 && !isIdentifier(element))
                return false;
            if (i % 2 === 0 && element !== ",")
                return false;
        }
        return true;
    }, false, key ?? "params");
}
function getParamDefListIdents(params) {
    if (params == null)
        return null;
    return params.filter((s, i) => (i % 2 === 1));
}
class SMultiStatement extends IStatement {
    constructor(context, list) {
        super(context);
        this.__list = list;
    }
    async process(context) {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            await substate.process(context);
        }
    }
}
export class SExit extends IStatement {
    constructor(context) { super(context); }
    async process(context) { }
}
class SMap extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) {
        if (!stream.isArray && !stream.isMap)
            throw 'map function expected to process an array or map';
    }
    async __onOpenChildScope(context, stream) {
        if (stream.isArray)
            return stream.asArray().slice();
        else if (stream.isMap)
            return stream.mapToPairsArr();
        throw 'unexpected stream';
    }
    async __onCloseChildScope(context, streams) {
        return Stream.mkArr(streams);
    }
}
class SPivot extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) {
        if (!stream.isArray)
            throw 'pivot function expected to process an array';
    }
    async __onOpenChildScope(context, stream) {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    async __onCloseChildScope(context, streams) {
        const prev = context.scratch.asArray();
        let rawmap = new Map();
        let map = new Map();
        for (let i = 0; i < prev.length; i++) {
            if (!streams[i].canBeKey())
                throw `Stream ${i} cannot be converted to a key to be a pivot`;
            const key = streams[i].toKey();
            const val = prev[i];
            if (!rawmap.has(key))
                rawmap.set(key, []);
            rawmap.get(key).push(val);
        }
        for (const key of rawmap.keys()) {
            map.set(key, Stream.mkArr(rawmap.get(key)));
        }
        return Stream.mkMap(map);
    }
}
class SFilter extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) {
        if (!stream.isArray)
            throw 'filter function expected to process an array';
    }
    async __onOpenChildScope(context, stream) {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    async __onCloseChildScope(context, streams) {
        const prev = context.scratch.asArray();
        const filtered = prev.filter((v, i) => streams[i].asBool());
        return Stream.mkArr(filtered);
    }
}
class SSortBy extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) {
        if (!stream.isArray)
            throw 'sortBy command expected to process an array';
    }
    async __onOpenChildScope(context, stream) {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    async __onCloseChildScope(context, streams) {
        const prev = context.scratch.asArray();
        let idxes = Object.keys(prev);
        idxes.sort((a, b) => {
            return Stream.Compare(streams[a], streams[b]);
        });
        const sorted = idxes.map(i => prev[i]);
        return Stream.mkArr(sorted);
    }
}
class SSumBy extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) {
        if (!stream.isArray)
            throw 'sumBy command expected to process an array';
    }
    async __onOpenChildScope(context, stream) {
        return stream.asArray().slice();
    }
    async __onCloseChildScope(context, streams) {
        let total = 0;
        for (const node of streams) {
            total += node.asNum();
        }
        return Stream.mkNum(total);
    }
}
class SDo extends SScopeFunction {
    constructor(context, res) {
        super(context, res);
    }
    async __onProcess(context, stream) { }
    async __onOpenChildScope(context, stream) {
        return [stream];
    }
    async __onCloseChildScope(context, streams) {
        if (streams.length != 1)
            throw 'how did do get multiple streams?';
        return streams[0];
    }
}
export class SFunctionDef extends IStatement {
    constructor(context, parse) {
        super(context);
        this.code = [];
        this.name = parse.getSingleKey("fn");
        var params = parse.tryGetByKey("params");
        this.params = getParamDefListIdents(params) ?? [];
    }
    async process(context) { }
    registerChildLine(statement) {
        this.code.push(statement);
    }
    get displayDef() { return `${this.name}(${this.params.join(",")})`; }
}
class SStoreLocal extends IStatement {
    constructor(context, parse) {
        super(context);
        this.__ident = parse.getSingleKey("ident");
        context.registerIdent(this.__ident);
        this.__exp = Parser.tryParseExpression(context, parse.tryGetByKey("any"));
    }
    async process(context) {
        const result = await this.__exp.Eval(context, context.stream);
        context.saveVar(this.__ident, result);
    }
}
class SStoreLocalScoped extends ICanHaveScope {
    constructor(context, parse) {
        super(context);
        this.__ident = parse.getSingleKey("ident");
        context.registerIdent(this.__ident);
        this._state = Parser.ParseStatements(context, parse.tryGetByKey("statement"));
    }
    async process(context) {
        context.saveVar(this.__ident, new Stream()); // in case you don't actually open a scope?
        this._state.process(context);
    }
    onOpenChildScope(context) {
        return this._state.onOpenChildScope(context);
    }
    async onCloseChildScope(context, streams) {
        let result = await this._state.onCloseChildScope(context, streams);
        context.saveVar(this.__ident, result);
        return context.stream;
    }
}
class SExpression extends IStatement {
    constructor(context, parse) {
        super(context);
        this.__exp = Parser.tryParseExpression(context, parse.GetSlice());
        if (!this.__exp)
            throw 'could not parse expression';
    }
    async process(context) {
        const result = await this.__exp.Eval(context, context.stream);
        context.updateStream(result);
    }
}
export class SNoop extends IStatement {
    constructor(context) { super(context); }
    async process(context) { }
}
class EIdentifier extends IExpression {
    constructor(parse) {
        super();
        this.name = parse.getSingleKey("ident");
    }
    async Eval(context, stream) {
        let func = _builtInFuncs[this.name];
        if (func != null) {
            return await EFunctionCall.runFunc(this.name, [], context, stream);
        }
        if (stream != context.stream)
            throw `cannot evaluate ${this.name} as a method`;
        let obj = context.get(this.name);
        if (obj == null)
            throw `unknown variable "${this.name}"`;
        return obj;
    }
}
class EStream extends IExpression {
    constructor() { super(); }
    async Eval(context, stream) {
        return context.stream;
    }
}
class EIndex extends IExpression {
    constructor() { super(); }
    async Eval(context, stream) { return Stream.mkNum(context.leafNode.index); }
}
class ETrueLiteral extends IExpression {
    constructor() { super(); }
    async Eval(context, stream) { return Stream.mkBool(true); }
}
class EFalseLiteral extends IExpression {
    constructor() { super(); }
    async Eval(context, stream) { return Stream.mkBool(false); }
}
class ENumericLiteral extends IExpression {
    constructor(parse) {
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    async Eval(context, stream) {
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
    async Eval(context, stream) {
        return new Stream(this.__str);
    }
}
class EExpression extends IExpression {
    constructor(context, parse) {
        super();
        let tokes = parse.tryGetByKey("exp");
        this.__inner = Parser.tryParseExpression(context, tokes);
    }
    async Eval(context, stream) {
        return this.__inner.Eval(context, stream);
    }
}
class EArrayDef extends IExpression {
    constructor(context, parse) {
        super();
        let tokes = parse.tryGetByKey("exp");
        if (tokes == null)
            this.__elements = []; // the [] case
        else
            this.__elements = Parser.tryParseExpressions(context, tokes);
    }
    async Eval(context, stream) {
        const tasks = this.__elements.map(async (e) => await e.Eval(context, stream));
        const elems = await Promise.all(tasks);
        return Stream.mkArr(elems);
    }
}
class EUnary extends IExpression {
    constructor(context, parse) {
        super();
        this.__right = Parser.tryParseExpression(context, parse.tryGetByKey("exp"));
        this.__op = parse.getSingleKey("unary");
    }
    async Eval(context, stream) {
        const a = await this.__right.Eval(context, stream);
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
        for (let forIdx = 0; forIdx < opIdx.length; forIdx++) {
            const idx = opIdx[forIdx];
            const newOp = new EOperator(stack[idx], ops[idx], stack[idx + 1]);
            stack[idx] = newOp;
            stack.splice(idx + 1, 1);
            ops.splice(idx, 1);
            opIdx = opIdx.map(i => i > idx ? i - 1 : i);
        }
        // should only be 1 element left
        return stack[0];
    }
    async Eval(context, stream) {
        const a = await this.__left.Eval(context, stream);
        if (this.__op == ":") {
            return await this.__right.Eval(context, a);
        }
        const b = await this.__right.Eval(context, stream);
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
                return 5;
            default: throw 'operator does not have priority?';
        }
    }
}
class EFunctionCall extends IExpression {
    constructor(context, parse) {
        super();
        this.name = parse.getSingleKey("ident");
        this.params = Parser.tryParseParamList(context, parse);
    }
    async Eval(context, stream) {
        return await EFunctionCall.runFunc(this.name, this.params, context, stream);
    }
    static async runFunc(name, params, context, stream) {
        let dynamic = context.__state.functionDefs[name];
        let func = _builtInFuncs[name];
        if (func == null && dynamic == null)
            throw 'could not find function ' + name;
        if (dynamic) {
            if (params.length > dynamic.params.length)
                throw `${name} expected ${dynamic.params.length} params, got ${params.length}`;
            let resolved = [];
            for (const p of params) {
                resolved.push(await p.Eval(context, stream));
            }
            return await Interpreter.RunUserFunction(context, dynamic, resolved, stream);
        }
        else {
            if (params.length < func.minP || params.length > func.maxP)
                throw `${name} expected ${func.minP}-${func.maxP} params, got ${params.length}`;
            return await func.action(context, stream, params);
        }
    }
}
const _builtInFuncs = {};
export function regFunc(name, minP, maxP, params, action) {
    _builtInFuncs[name] = mkFunc(name, minP, maxP, params, action);
}
function mkFunc(name, minP, maxP, params, action) {
    return { name, minP, maxP, params, action };
}
function arrCount(arr, ...elems) {
    if (arr.length == 0)
        return 0;
    return arr.map(curr => elems.includes(curr) ? 1 : 0).reduce((sum, curr) => sum + curr);
}
//# sourceMappingURL=parser.js.map