import { ExecutionContext, Interpreter, LineError } from "./interpreter.js";
import { Lexer, LexLine } from "./Lexer.js";
import { CompMatch } from "./main.js";
import { Match, pattern, PatternResult, SingleMatch, Syntax } from "./patterns.js";
import { IKey, Stream } from "./stream.js";

export class Parser{
    public static Parse(code: string): ParseContext{
        const lines = code.split("\n");
        let context = new ParseContext();
        for (let ln = 0; ln < lines.length; ln++) {
            const code = lines[ln];
            try {
                let state = this.ParseLine(context, code);
                if(state) state.fileLine = ln;
                context.push(state);
            } 
            catch(err) { throw new LineError(err, ln); }
        }
        return context;
    }
    
    public static ParseLine(context: ParseContext, code: string): IStatement{
        const tokens = Lexer.Tokenize(code);
        context.prepNewLine(tokens);
        if(tokens.Tokens.length == 0) return new SNoop(context);
        return this.ParseStatements(context, tokens.Tokens);
    }

    public static ParseStatements(context: ParseContext, tokens:string[]): IStatement{
        let idx = 0;
        let states: IStatement[] = [];
        while(idx < tokens.length){
            let match = _statements.firstPartialMatch(tokens, idx);
            if(match == null) return null;
            states.push(match.output(context, match.result));
            idx = match.result.endIndex + 1;
            if(idx < tokens.length && tokens[idx] == ">>") idx++;
            else if(idx < tokens.length) return null;
        }
        let result: IStatement;
        if(states.length == 0) result = null;
        else if(states.length == 1) result = states[0];
        else result = new SMultiStatement(context, states);
        return result;
    }

    public static tryParseParamList(context: ParseContext, parse: PatternResult<string>, key?: string): IExpression[] | null{
        let tokes = parse?.tryGetByKey(key ?? "params");
        if(tokes == null) return [];
        return Parser.tryParseExpressions(context, tokes.slice(1, -1));
    }

    // null is valid, but a buggy expresison will throw
    public static tryParseExpressions(context: ParseContext, tokens: string[]): IExpression[]{
        let outputs: IExpression[] = [];
        let idx = 0;
        let stack: IExpression[] = [];
        let ops: string[] = [];
        while(true){
            let match = _expressionComps.firstPartialMatch(tokens, idx);
            if(match == null) return null;
            stack.push(match.output(context, match.result));
            idx = match.result.endIndex + 1;
            if(idx >= tokens.length || tokens[idx] == ",") {
                idx++;
                if(stack.length == 1) {
                    outputs.push(stack[0]);
                }
                else{
                    outputs.push(EOperator.SplitEquation(stack, ops));
                }
                stack = [];
                ops = [];
                if(idx >= tokens.length) break;
            }
            else if(EOperator.IsOperator(tokens[idx])) {
                ops.push(tokens[idx]);
                idx++;
                if(idx >= tokens.length) throw 'expected expression to continue';
            }
            else throw 'unexpected symbol ' + tokens[idx];
        }
        return outputs;
    }
    public static tryParseExpression(context: ParseContext,tokens: string[]): IExpression{
        let arr = this.tryParseExpressions(context, tokens);
        if(!arr || arr.length != 1) return null;
        return arr[0];
    }

    public static getBuiltInsSymbols(): CompMatch[]{
        var list: CompMatch[] = [];
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
    private static getFuncDisplay(func: IFunction): string{
        let params = func.params.map((v,i) => v + (i >= func.minP ? "?" : ""));
        return `${func.name}(${params.join(", ")})`;
    }
}

export class ParseContext{
    public Statements: IStatement[] = [];
    public currLineDepth: number = 0;
    public functionDefs: Record<string, SFunctionDef> = {};
    public identifiers: Set<string> = new Set();
    private _parseStateFunc: SFunctionDef = null;
    public push(statement: IStatement){
        if(this._parseStateFunc) {
            statement.tabDepth--;
            this._parseStateFunc.registerChildLine(statement);
        } else if(statement instanceof SFunctionDef) {
            this.registerFunction(statement);
        } else {
            this.Statements.push(statement);
        }
    }
    public prepNewLine(lex: LexLine){
        if(lex.TabDepth == 0) this._parseStateFunc = null;
        this.currLineDepth = this.getDepth(lex.TabDepth);
    }
    public registerIdent(ident: string){ this.identifiers.add(ident); }
    public getScope(tabDepth: number):IStatement | null{
        if(tabDepth == 0) return null;
        for (let index = this.Statements.length - 1; index >= 0; index--) {
            const state = this.Statements[index];
            if(state.tabDepth < tabDepth) return state;
        }
        return null;
    }
    public getDepth(tabDepth: number): number{
        let count = 0;
        for (let index = this.Statements.length - 1; index >= 0; index--) {
            const state = this.Statements[index];
            if(!state) return count;
            if(state.tabDepth < tabDepth) {
                count++;
                tabDepth = state.tabDepth;
            }
        }
        return count;
    }
    public registerFunction(func: SFunctionDef){
        this._parseStateFunc = func;
        this.functionDefs[func.name] = func;
        for (const p of func.params) {
            this.registerIdent(p);
        }
    }
}

const _keywordStatements = ["map", "filter",
        "sortBy", "sumBy", "exit", "stream", "fileName",
        "index", "true", "false", "pivot", "function"];
type StatementGenerator = (con: ParseContext, result: PatternResult<string>) => IStatement;
const _scopeStatements = new Syntax<string, StatementGenerator>()
    .addAnyOf(scopeStatement("sortBy"), (con, res) => new SSortBy(con, res))
    .addAnyOf(scopeStatement("sumBy"), (con, res) => new SSumBy(con, res))
    .addAnyOf(scopeStatement("map"), (con, res) => new SMap(con, res))
    .addAnyOf(scopeStatement("filter"), (con, res) => new SFilter(con, res))
    .addAnyOf(scopeStatement("pivot"), (con, res) => new SPivot(con, res))
    .addAnyOf(scopeStatement("do"), (con, res) => new SDo(con, res))
;
const _statements = new Syntax<string, StatementGenerator>()
    .addMulti(_scopeStatements)
    .add([token("exit")], (con, res) => new SExit(con))
    .add([identifier(), token("<<"), scopeStatementLike()], (con, res) => new SStoreLocalScoped(con, res))
    .add([identifier(), token("<<"), Match.anything()], (con, res) => new SStoreLocal(con, res))
    .add([token("function"), identifier("fn"), parameterDefList()], (con, res) => new SFunctionDef(con, res))
    .add([token("function"), identifier("fn")], (con, res) => new SFunctionDef(con, res))
    .add([expressionLike(">>")], (con, res) => new SExpression(con, res))
;

type ExpressionGenerator = (context: ParseContext, result: PatternResult<string>) => IExpression;
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax<string, ExpressionGenerator>()
    .add([identifier(), token("("), token(")")], (con,res) => new EFunctionCall(con, res))
    .add([identifier(), parameterList(false)],(con,res) => new EFunctionCall(con, res))
    .add([token("stream")], res => new EStream())
    .add([token("index")], res => new EIndex())
    .add([token("true")], res => new ETrueLiteral())
    .add([token("false")], res => new EFalseLiteral())
    .add([identifier()],(con,res) => new EIdentifier(res))
    .add([unary(), expressionLike()], (con,res) => new EUnary(con, res))
    .add([literalNumber()], (con,res) => new ENumericLiteral(res))
    .add([literalString()], (con,res) => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], (con,res) => new EExpression(con, res))
    .add([token("["), token("]")], (con,res) => new EArrayDef(con, res))
    .add([token("["), expressionLike(), token("]")], (con,res) => new EArrayDef(con, res))
;

export abstract class IStatement{
    tabDepth: number;
    fileLine: number;
    public constructor(context: ParseContext){
        this.tabDepth = context.currLineDepth;
    }
    public abstract process(context: ExecutionContext):Promise<void>;
}
export abstract class ICanHaveScope extends IStatement{
    public abstract onOpenChildScope(context: ExecutionContext): Promise<Stream[]>;
    public abstract onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream>;
}
export abstract class SScopeFunction extends ICanHaveScope{
    __preExp: IExpression = null;
    __postExp: IExpression = null;
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context);
        let pre = res.tryGetByKey("pre");
        let post = res.tryGetByKey("post");
        if(pre) this.__preExp = Parser.tryParseExpression(context, pre);
        if(post) this.__postExp = Parser.tryParseExpression(context, post);
    }
    public async process(context: ExecutionContext): Promise<void> {
        context.scratch = await this.__preExp?.Eval(context, context.stream) ?? context.stream;
        await this.__onProcess(context, context.scratch);
    }
    public async onOpenChildScope(context: ExecutionContext): Promise<Stream[]> {
        return await this.__onOpenChildScope(context, context.scratch);
    }
    public async onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        let scratch = await this.__onCloseChildScope(context, streams);
        if(!this.__postExp) { return scratch; }
        return await this.__postExp.Eval(context, scratch);
    }
    public abstract __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]>;
    public abstract __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream>;
    public abstract __onProcess(context: ExecutionContext, stream: Stream): Promise<void>;
}

abstract class IExpression{
    public abstract Eval(context: ExecutionContext, stream: Stream): Promise<Stream>;
    public async EvalAsText(context: ExecutionContext): Promise<string>{
        let out = await this.Eval(context, context.stream);
        if(out.text == null) throw 'expected expression to evaluate as string, got '+ out.toDisplayText();
        return out.text;
    }
}

function token(match: string, optional?: boolean):SingleMatch<string> {
    return Match.token(match, optional);
}
function debugToken():SingleMatch<string>{
    return Match.debugMatch();
}

function unary(): SingleMatch<string>{
    return Match.anyOf(["!", "-"], false, "unary");
}

function identifier(key?: string):SingleMatch<string> {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i), false, key ?? "ident");
}
function isIdentifier(s: string): boolean{
    return s.match(/^[$A-Z_][0-9A-Z_$]*$/i) !== null;
}
function literalNumber():SingleMatch<string> {
    return Match.testToken(t => !isNaN(+t) && isFinite(+t));
}
function literalString():SingleMatch<string> {
    return Match.testToken(t => t[0] === "\""); // shouldn't have lexed anything else with a leading "
}

function scopeStatementLike(): SingleMatch<string>{
    return Match.testRemainder(t => {
        let test = _scopeStatements.firstPartialMatch(t, 0);
        return test?.result.length == t.length;
    }, false, "statement");
}

function scopeStatement(func: string): SingleMatch<string>[][]{
    const splitter = "::";
    return [
        [
            token(func),
            debugToken(),
            token(splitter),
            expressionLike(null, false, "post"),
        ],
        [ token(func) ],
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

function expressionLike(stop?: string, optional?: boolean, key?: string):SingleMatch<string> {
    return Match.testSequence(tokes => {
        const trail = tokes[token.length-1];
        if(stop && trail === stop) return false;
        const lPars = arrCount(tokes, "(", "[");
        const rPars = arrCount(tokes, ")", "]");
        if(lPars < rPars) return false;
        if(lPars > rPars) return null;
        return true;
    }, optional, key ?? "exp");
}
function parameterList(optional?: boolean): SingleMatch<string>{
    return Match.testPattern(pattern(
        token("("),
        expressionLike(null, true), // this doesn't seem to actually be optional?
        token(")")
    ), optional, "params");
}
function parameterDefList(key?: string):SingleMatch<string> {
    return Match.testSequence(tokes => {
        if(tokes.length == 0) return null; // do I really need to handle this here?
        if(tokes[0] !== "(") return false;
        if(tokes[token.length-1] === ")") return true;
        for (let i = 1; i < tokes.length - 1; i++) {
            const element = tokes[i];
            if(i%2 === 1 && !isIdentifier(element)) return false;
            if(i%2 === 0 && element !== ",") return false;
        }
        return true;
    }, false, key ?? "params");
}
function getParamDefListIdents(params: string[]): string[]{
    if(params == null) return null;
    return params.filter((s,i) => (i % 2 === 1));
}

class SMultiStatement extends IStatement{
    __list : IStatement[];
    public constructor(context: ParseContext, list: IStatement[]){
        super(context);
        this.__list = list;
    }
    public override async process(context: ExecutionContext): Promise<void> {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            await substate.process(context);
        }
    }
}

export class SExit extends IStatement{
    public constructor(context: ParseContext){super(context); }
    public override async process(context: ExecutionContext): Promise<void> {}
}

class SMap extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> {
        if(!stream.isArray && !stream.isMap) throw 'map function expected to process an array or map';
    }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        if(stream.isArray)
            return stream.asArray().slice();
        else if (stream.isMap)
            return stream.mapToPairsArr();
        throw 'unexpected stream';
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        return Stream.mkArr(streams);
    }
}

class SPivot extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> {
        if(!stream.isArray) throw 'pivot function expected to process an array';
    }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        const prev = context.scratch.asArray();
        let rawmap = new Map<IKey, Stream[]>();
        let map = new Map<IKey, Stream>();
        for (let i = 0; i < prev.length; i++) {
            if(!streams[i].canBeKey()) throw `Stream ${i} cannot be converted to a key to be a pivot`;
            const key = streams[i].toKey();
            const val = prev[i];
            if(!rawmap.has(key)) rawmap.set(key, []);
            rawmap.get(key).push(val);
        }
        for (const key of rawmap.keys()) {
            map.set(key, Stream.mkArr(rawmap.get(key)));
        }
        return Stream.mkMap(map);
    }
}

class SFilter extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> {
        if(!stream.isArray) throw 'filter function expected to process an array';
    }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        const prev = context.scratch.asArray();
        const filtered = prev.filter((v,i) => streams[i].asBool());
        return Stream.mkArr(filtered);
    }
}

class SSortBy extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> {
        if(!stream.isArray) throw 'sortBy command expected to process an array';
    }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        let arr = stream.asArray().slice();
        context.scratch = Stream.mkArr(arr);
        return arr;
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        const prev = context.scratch.asArray();
        let idxes = Object.keys(prev);
        idxes.sort((a,b) => {
            return Stream.Compare(streams[a], streams[b]);
        });
        const sorted = idxes.map(i => prev[i]);
        return Stream.mkArr(sorted);
    }
}

class SSumBy extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> {
        if(!stream.isArray) throw 'sumBy command expected to process an array';
    }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        return stream.asArray().slice();
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        let total = 0;
        for (const node of streams) {
            total += node.asNum();
        }
        return Stream.mkNum(total);
    }
}

class SDo extends SScopeFunction{
    public constructor(context: ParseContext, res: PatternResult<string>){
        super(context, res);
    }
    public async __onProcess(context: ExecutionContext, stream: Stream): Promise<void> { }
    public async __onOpenChildScope(context: ExecutionContext, stream: Stream): Promise<Stream[]> {
        return [stream];
    }
    public async __onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        if(streams.length != 1) throw 'how did do get multiple streams?';
        return streams[0];
    }
}

export class SFunctionDef extends IStatement{
    public name: string;
    public params: string[];
    public code: IStatement[] = [];
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super(context);
        this.name = parse.getSingleKey("fn");
        var params = parse.tryGetByKey("params");
        this.params = getParamDefListIdents(params) ?? [];
    }
    public async process(context: ExecutionContext): Promise<void> {}
    public registerChildLine(statement: IStatement){
        this.code.push(statement);
    }
    public get displayDef(): string { return `${this.name}(${this.params.join(",")})`; }
}

class SStoreLocal extends IStatement{
    __ident: string;
    __exp: IExpression;
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super(context);
        this.__ident = parse.getSingleKey("ident");
        context.registerIdent(this.__ident);
        this.__exp = Parser.tryParseExpression(context, parse.tryGetByKey("any"));
    }
    public async process(context: ExecutionContext): Promise<void> {
        const result = await this.__exp.Eval(context, context.stream);
        context.saveVar(this.__ident, result);
    }
}

class SStoreLocalScoped extends ICanHaveScope{
    __ident: string;
    _state: ICanHaveScope;
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super(context);
        this.__ident = parse.getSingleKey("ident");
        context.registerIdent(this.__ident);
        this._state = Parser.ParseStatements(context, parse.tryGetByKey("statement")) as ICanHaveScope;
    }
    public async process(context: ExecutionContext): Promise<void> {
        context.saveVar(this.__ident, new Stream()); // in case you don't actually open a scope?
        this._state.process(context);
    }
    public onOpenChildScope(context: ExecutionContext): Promise<Stream[]> {
        return this._state.onOpenChildScope(context);
    }
    public async onCloseChildScope(context: ExecutionContext, streams: Stream[]): Promise<Stream> {
        let result = await this._state.onCloseChildScope(context, streams);
        context.saveVar(this.__ident, result);
        return context.stream;
    }
}

class SExpression extends IStatement{
    __exp: IExpression;
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super(context);
        this.__exp = Parser.tryParseExpression(context, parse.GetSlice());
        if(!this.__exp) throw 'could not parse expression';
    }
    public async process(context: ExecutionContext): Promise<void> {
        const result = await this.__exp.Eval(context, context.stream);
        context.updateStream(result);
    }
}

export class SNoop extends IStatement{
    public constructor(context: ParseContext){super(context);}
    public async process(context: ExecutionContext): Promise<void> {}
}


class EIdentifier extends IExpression{
    name: string;
    public constructor(parse: PatternResult<string>){
        super();
        this.name = parse.getSingleKey("ident");
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        let func = _builtInFuncs[this.name];
        if(func != null){
            return await EFunctionCall.runFunc(this.name, [], context, stream);
        }
        if(stream != context.stream) throw `cannot evaluate ${this.name} as a method`;
        let obj = context.get(this.name);
        if(obj == null) throw `unknown variable "${this.name}"`;
        return obj;
    }
}

class EStream extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
         return context.stream;
    }
}
class EIndex extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> { return Stream.mkNum(context.leafNode.index); }
}

class ETrueLiteral extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> { return Stream.mkBool(true); }
}

class EFalseLiteral extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> { return Stream.mkBool(false); }
}

class ENumericLiteral extends IExpression{
    __num: number;
    public constructor(parse: PatternResult<string>){
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        return new Stream(null, null, this.__num);
    }
}

class EStringLiteral extends IExpression{
    __str : string;
    public constructor(parse: PatternResult<string>){
        super();
        const str = parse.PullOnlyResult();
        // this seems like something where there should be a better way...
        this.__str = JSON.parse(str);// str.substring(1, str.length - 1).replace();
        
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        return new Stream(this.__str);
    }
}

class EExpression extends IExpression{
    __inner : IExpression;
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super();
        let tokes = parse.tryGetByKey("exp");
        this.__inner = Parser.tryParseExpression(context, tokes);
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        return this.__inner.Eval(context, stream);
    }
}

class EArrayDef extends IExpression{
    __elements : IExpression[];
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super();
        let tokes = parse.tryGetByKey("exp");
        if(tokes == null) this.__elements = []; // the [] case
        else this.__elements = Parser.tryParseExpressions(context, tokes);
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        const tasks = this.__elements.map(async e => await e.Eval(context, stream));
        const elems = await Promise.all(tasks);
        return Stream.mkArr(elems);
    }
}

class EUnary extends IExpression{
    __right: IExpression;
    __op: string;

    public constructor(context: ParseContext, parse: PatternResult<string>){
        super();
        this.__right = Parser.tryParseExpression(context, parse.tryGetByKey("exp"));
        this.__op = parse.getSingleKey("unary");
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        const a = await this.__right.Eval(context, stream);
        return a.runUnary(this.__op);
    }
}

class EOperator extends IExpression{
    __left: IExpression;
    __right: IExpression;
    __op: string;
    public constructor(left: IExpression, op: string, right: IExpression){
        super();
        this.__left = left;
        this.__right = right;
        this.__op = op;
    }
    public static SplitEquation(stack: IExpression[], ops: string[]) : IExpression{
        let opIdx: number[] = ops.map((o, i) => i);
        opIdx.sort((a,b) => {
            // sorts higher operators to later
            if(a === b) return 0; // shouldn't happen?
            const aa = EOperator.OpPriority(ops[a]);
            const bb = EOperator.OpPriority(ops[b]);
            if(aa == bb) return (a > b) ? 1 : -1;
            if(aa > bb) return 1;
            if(aa < bb) return -1;
            throw 'unreachable';
        });
        for (let forIdx = 0; forIdx < opIdx.length; forIdx++) {
            const idx = opIdx[forIdx];
            const newOp = new EOperator(stack[idx], ops[idx], stack[idx + 1]);
            stack[idx] = newOp;
            stack.splice(idx + 1, 1);
            ops.splice(idx, 1);
            opIdx = opIdx.map(i => i > idx ? i - 1: i);
        }
        // should only be 1 element left
        return stack[0];
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        const a = await this.__left.Eval(context, stream);
        if(this.__op == ":"){
            return await this.__right.Eval(context, a);
        }
        const b = await this.__right.Eval(context, stream);
        return a.runOp(this.__op, b);
    }
    public static IsOperator(op: string): boolean{
        switch (op) {
            case "!=":
                return true;
            default: return "+-=*/&|<>.:".includes(op);
        }
    }
    public static OpPriority(op: string): number{
        // higher means later
        switch(op){
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

class EFunctionCall extends IExpression{
    name: string;
    params: IExpression[];
    public constructor(context: ParseContext, parse: PatternResult<string>){
        super();
        this.name = parse.getSingleKey("ident");
        this.params = Parser.tryParseParamList(context, parse);
    }
    public async Eval(context: ExecutionContext, stream: Stream): Promise<Stream> {
        return await EFunctionCall.runFunc(this.name, this.params, context, stream);
    }
    public static async runFunc(name: string, params: IExpression[], context: ExecutionContext, stream: Stream): Promise<Stream>{
        let dynamic = context.__state.functionDefs[name];
        let func = _builtInFuncs[name];
        if(func == null && dynamic == null) throw 'could not find function ' + name;
        if(dynamic){
            if(params.length > dynamic.params.length)
                throw `${name} expected ${dynamic.params.length} params, got ${params.length}`;
            let resolved: Stream[] = [];
            for (const p of params) {
                resolved.push(await p.Eval(context, stream));
            }
            return await Interpreter.RunUserFunction(context, dynamic, resolved, stream);
        } else {
            if(params.length < func.minP || params.length > func.maxP)
                throw `${name} expected ${func.minP}-${func.maxP} params, got ${params.length}`;
            return await func.action(context, stream, params);
        }
    }
}

const _builtInFuncs: Record<string, IFunction> = {};

interface IFunction{
    name: string;
    minP: number;
    maxP: number;
    params: string[];
    action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>;
}

export function regFunc(name: string, minP: number, maxP: number, params:string[], action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>) {
    _builtInFuncs[name] = mkFunc(name, minP, maxP, params, action);
}

function mkFunc(name: string, minP: number, maxP: number,params:string[], action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>):IFunction {
    return {name, minP, maxP, params, action};
}

function arrCount<T>(arr: T[], ...elems:T[]): number
{
    if(arr.length == 0) return 0;
    return arr.map<number>(curr => elems.includes(curr) ? 1 : 0).reduce((sum, curr) => sum + curr);
}