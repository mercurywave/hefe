import { Lexer } from "./Lexer.js";
import { Match, Pattern, pattern, PatternResult, SingleMatch, Syntax } from "./patterns.js";

export interface InputContext{
    text: string;
    fileName: string;
}

export class Interpreter{
    static __gen = 0;
    public static async Process(input: InputContext, code: IStatement[]): Promise<TransformResult>{
        let state = new InterpreterState(input.text);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        this.__gen++;
        let currGen = this.__gen;
        let lastScope:IStatement | null = null;

        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if(step instanceof SNoop) continue;
            if(step == null) return {output: state.exportAsStream(), step: state.line, isComplete: false, error: "could not parse line: " + ln};
            state.line = ln;
            if(step.tabDepth + 1 > state.depth && lastScope)
                state.pushStack(lastScope);
            while(state.depth > step.tabDepth + 1)
                state.popStack();
            if(step instanceof SExit) return {output: state.exportAsStream(), step:  state.line, isComplete: true};
            try{
                await Interpreter.parallelProcess(state, 0, step);
            } catch(err){
                return {output: state.exportAsStream(), step: state.line, isComplete: false, error: err};
            }
            lastScope = step;
            await new Promise(f => setTimeout(f, 1));
            if(currGen != this.__gen) return null;
        }
        while(state.depth > 1)
            state.popStack();
        return {output: state.exportAsStream(), step:  state.line, isComplete: true};
    }
    
    static async parallelProcess(state: InterpreterState, depth: number, child: IStatement): Promise<void>{
        let futures: Promise<void>[] = [];
        state.foreachExecution(context => futures.push(child.process(context)) );
        await Promise.all(futures);
    }

    public static getBuiltinSymbols(): string[]{
        return getBuiltInsSymbols();
    }
}

export interface TransformResult{
    output: Stream;
    step: number;
    isComplete: boolean;
    error?: string
}

export class ExecutionContext{
    __currBranch: StackBranch[];
    __state: InterpreterState;

    public constructor(currBranch: StackBranch[], state: InterpreterState){
        this.__currBranch = currBranch;
        this.__state = state;
    }

    public get stream(): Stream { return this.leafNode.stream;}
    public get leafNode(): StackBranch { return this.__currBranch[this.__currBranch.length - 1]; }

    public updateStream(stream: Stream){
        var stack = this.leafNode;
        stack.stream = stream;
    }
    public saveVar(name: string, value: Stream){
        this.leafNode.set(name, value);
    }
    public get(name: string): Stream | null{
        for(let idx = this.__currBranch.length - 1; idx >= 0; idx--){
            const obj = this.__currBranch[idx].get(name);
            if(obj != null) return obj;
        }
        return null;
    }
}

export class InterpreterState{
    __root: StackBranch;
    __scopes: IStatement[] = [null];
    public line: number = -1;

    public constructor(stream: string){
        this.__root = new StackBranch(Stream.mkText(stream), 0);
    }

    public get depth(): number {return this.__scopes.length;}

    public foreachExecution(action: (context: ExecutionContext) => void, depth?: number){
        this.foreachChain((c) => action(new ExecutionContext(c, this)));
    }
    foreachChain(action: (chain: StackBranch[], leaf: StackBranch) => void, depth?: number){
        this.chainIterHelper(action, this.__root, [this.__root], depth ?? (this.depth - 1));
    }
    chainIterHelper(action: (chain: StackBranch[], leaf: StackBranch) => void, node: StackBranch, chain: StackBranch[], depth: number){
        if(depth == 0){
            action(chain, node);
        }
        else {
            for (const branch of node.__branches) {
                this.chainIterHelper(action, branch, chain.slice().concat(branch), depth - 1);
            }
        }
    }

    public pushStack(state: IStatement){
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const streams = state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        });
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    public popStack(){
        let owner = this.__scopes.pop();
        // since we popped, the leafs have branches
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const branches = leaf.branches.map(b => b.stream);
            owner.onCloseChildScope(context, branches);
            leaf.branches = null;
        });
    }

    public exportAsStream(): Stream{
        if(this.depth == 1)
            return this.__root.stream;
        let streams: Stream[] = [];
        this.foreachChain((c,l) => streams.push(l.stream));
        if(streams.length == 1) return streams[0];
        return Stream.mkArr(streams);
    }

    public setGlobalVal(name: string, value: Stream){
        this.__root.set(name, value);
    }
}

class StackBranch{
    __stream: Stream;
    __branches: StackBranch[];
    variables: Record<string, Stream> = {};
    index: number;
    public constructor(stream: Stream, index: number){
        this.__stream = stream;
        this.index = index;
    }
    public get(name: string): Stream | null{
        return this.variables[name];
    }
    public set(name: string, value: Stream){
        this.variables[name] = value;
    }
    public get stream(): Stream { return this.__stream; }
    public set stream(stream: Stream) { this.__stream = stream; }
    public set branches(leafs: StackBranch[]) {this.__branches = leafs;}
    public get branches(): StackBranch[] { return this.__branches; }
    public addBranch(leaf: StackBranch) {
        if(this.__branches == null)
            this.__branches = [];
        this.__branches.push(leaf);
    }
}

export enum eStreamType{
    Text, Num, Bool, Array
}
export class Stream {
    public text? : string;
    public array? : Stream[];
    public num? : number;
    public bool? : boolean;
    public constructor(text?: string, array?: Stream[], num?: number, bool?: boolean){
        this.text = text ?? null;
        this.array = array ?? null;
        this.num = num ?? null;
        this.bool = bool ?? null;
    }
    public static mkText(text: string): Stream{ return new Stream(text);}
    public static mkArr(arr: Stream[]): Stream{ return new Stream(null, arr);}
    public static mkNum(num: number): Stream{ return new Stream(null, null, num);}
    public static mkBool(bool: boolean): Stream{ return new Stream(null, null, null, bool);}
    public copy(): Stream {
        return new Stream(this.text, this.array?.slice(), this.num, this.bool);
    }

    public toDisplayText(nested?:number) : string{
        if(this.isText) {
            if(nested > 0) return "\"" + this.text + "\"";
            return this.text;
        }
        if(this.isNum) return "" + this.num;
        if(this.isBool) return "" + this.bool;
        if(this.isArray) return "[\n" + this.array.map(s => " " + s.toDisplayText((nested ?? 0) + 1)).join(",\n") + "\n]";
        return "???";
    }

    public static areEqual(a:Stream, b:Stream): boolean{
        if(a.text != null) return a.text === b.text;
        if(a.num != null) return a.num === b.num;
        if(a.bool != null) return a.bool === b.bool;
        if(a.array != null) throw 'array comparison not implemented';
        throw "couldn't compare null object?"
    }

    public static areSameType(a:Stream, b:Stream): boolean{
        return a.type == b.type;
    }

    public get type(): eStreamType{
        if(this.text !== null) return eStreamType.Text;
        if(this.num !== null) return eStreamType.Num;
        if(this.bool !== null) return eStreamType.Bool;
        if(this.array !== null) return eStreamType.Array;
        throw 'unknown type';
    }
    public canCastTo(type:eStreamType): boolean{
        switch (type) {
            case eStreamType.Array: return [eStreamType.Array].includes(type);
            case eStreamType.Bool: return [eStreamType.Bool, eStreamType.Num].includes(type);
            case eStreamType.Num: return [eStreamType.Num].includes(type);
            case eStreamType.Text: return [eStreamType.Text, eStreamType.Num, eStreamType.Bool].includes(type);
            default: throw 'type not implemented for canCast';
        }
    }
    public runOp(op: string, other: Stream): Stream{
        switch (op) {
            case "=": return new Stream(null, null, null, Stream.areEqual(this,other));
            case "!=": return new Stream(null, null, null, !Stream.areEqual(this,other));
            case "|": return Stream.mkBool(this.asBool() || other.asBool());
            case "&": return Stream.mkBool(this.asBool() && other.asBool());
            case "<": return Stream.mkBool(this.asNum() < other.asNum());
            case ">": return Stream.mkBool(this.asNum() > other.asNum());
            case "<=": return Stream.mkBool(this.asNum() <= other.asNum());
            case ">=": return Stream.mkBool(this.asNum() >= other.asNum());
            case "+":
                if(!other.canCastTo(this.type)) throw 'could not cast right side for +';
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
    public runUnary(op: string): Stream{
        switch(op){
            case "!": return Stream.mkBool(!this.asBool());
            case "-": return Stream.mkNum(-this.asNum());
            default: throw `unary not implemented ${op}`;
        }
    }
    public toRaw(): string | number | boolean | Stream[] | null {
        return this.text ?? this.num ?? this.bool ?? this.array;
    }
    public asNum(): number{
        if(this.num !== null) return this.num;
        throw 'cannot cast to number';
    }
    public asString(): string{
        if(this.text !== null) return this.text;
        if(this.num !== null) return "" + this.num;
        if(this.bool !== null) return "" + this.bool;
        throw 'cannot cast to string';
    }
    public asBool(): boolean{
        if(this.bool !== null) return this.bool;
        if(this.num !== null) return this.num != 0;
        throw 'cannot cast to bool';
    }
    public asArray(): Stream[]{
        if(this.array !== null) return this.array; // caution! original reference!
        throw 'cannot cast to array';
    }
    public get isNum(): boolean { return this.num !== null; }
    public get isText(): boolean { return this.text !== null; }
    public get isBool(): boolean { return this.bool !== null; }
    public get isArray(): boolean { return this.array !== null; }

    public static Compare(a: Stream, b: Stream): number{
        if(a === b) return 0;
        if(a == null) return -1;
        if(b == null) return 1;
        if(a.isNum && b.isNum) return a.num - b.num;
        if(a.isText && b.isText) return a.asString().localeCompare(b.asString());
        if(a.isBool && b.isBool) return (a.asBool() ? 1 : -1) + (b.asBool() ? -1 : 1);
        if(a.isArray && b.isArray){
            for (let i = 0; i < a.array.length && i < b.array.length; i++) {
                const comp = Stream.Compare(a.array[i], b.array[i]);
                if(comp != 0) return comp;
            }
            if(a.array.length > b.array.length) return 1;
            if(a.array.length < b.array.length) return -1;
            return 0;
        }
        if(a.isNum) return 1;
        if(b.isNum) return -1;
        if(a.isText) return 1;
        if(b.isText) return -1;
        if(a.isBool) return 1;
        if(b.isBool) return -1;
        throw 'unreachable comparison reached';
    }
}


export class Parser{
    public static Parse(code: string): IStatement[]{
        const lines = code.split("\n");
        let context = new ParseContext();
        for (let ln = 0; ln < lines.length; ln++) {
            const code = lines[ln];
            let state = this.ParseLine(code, context);
            context.push(state);
        }
        return context.Statements;
    }
    
    public static ParseLine(code: string, context: ParseContext): IStatement{
        const tokens = Lexer.Tokenize(code);
        let depth = context.getDepth(tokens.TabDepth);
        if(tokens.Tokens.length == 0) return new SNoop(tokens.TabDepth);
        return this.ParseStatements(tokens.Tokens, depth);
    }

    public static ParseStatements(tokens:string[], depth: number): IStatement{
        let idx = 0;
        let states: IStatement[] = [];
        while(idx < tokens.length){
            let match = _statements.firstPartialMatch(tokens, idx);
            if(match == null) return null;
            states.push(match.output(depth, match.result));
            idx = match.result.endIndex + 1;
            if(idx < tokens.length && tokens[idx] == ">>") idx++;
            else if(idx < tokens.length) return null;
        }
        let result: IStatement;
        if(states.length == 0) result = null;
        else if(states.length == 1) result = states[0];
        else result = new SMultiStatement(depth, states);
        return result;
    }

    public static tryParseParamList(parse: PatternResult<string>, key?: string): IExpression[] | null{
        let tokes = parse?.tryGetByKey(key ?? "params");
        if(tokes == null) return [];
        return this.tryParseExpressions(tokes.slice(1, -1));
    }

    // null is valid, but a buggy expresison will throw
    public static tryParseExpressions(tokens: string[]): IExpression[]{
        let outputs: IExpression[] = [];
        let idx = 0;
        let stack: IExpression[] = [];
        let ops: string[] = [];
        while(true){
            let match = _expressionComps.firstPartialMatch(tokens, idx);
            if(match == null) return null;
            stack.push(match.output(match.result));
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
    public static tryParseExpression(tokens: string[]): IExpression{
        let arr = this.tryParseExpressions(tokens);
        if(!arr || arr.length != 1) return null;
        return arr[0];
    }
}

class ParseContext{
    public Statements: IStatement[] = [];
    public push(statement: IStatement){
        this.Statements.push(statement);
    }
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
}

function getBuiltInsSymbols(): string[]{
    var list: string[] = Object.keys(_builtInFuncs);
    list.push("map", "filter", "sortBy", "exit", "stream", "index", "true", "false");
    return list;
}

type StatementGenerator = (depth: number, result: PatternResult<string>) => IStatement;
const _statements = new Syntax<string, StatementGenerator>()
    .add([token("map")], (dep, res) => new SMap(dep))
    .add([token("filter")], (dep, res) => new SFilter(dep))
    .add([token("exit")], (dep, res) => new SExit(dep))
    .add([token("sortBy")], (dep, res) => new SSortBy(dep))
    .add([identifier(), token("<<"), Match.anything()], (dep, res) => new SStoreLocal(dep, res))
    .add([expressionLike(">>")], (dep, res) => new SExpression(dep, res))
;

type ExpressionGenerator = (result: PatternResult<string>) => IExpression;
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax<string, ExpressionGenerator>()
    .add([identifier(), token("("), token(")")],res => new EFunctionCall(res))
    .add([identifier(), parameterList(false)],res => new EFunctionCall(res))
    .add([token("stream")], res => new EStream())
    .add([token("index")], res => new EIndex())
    .add([token("true")], res => new ETrueLiteral())
    .add([token("false")], res => new EFalseLiteral())
    .add([identifier()],res => new EIdentifier(res))
    .add([unary(), expressionLike()], res => new EUnary(res))
    .add([literalNumber()], res => new ENumericLiteral(res))
    .add([literalString()], res => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res))
;

abstract class IStatement{
    tabDepth: number;
    public constructor(depth: number){
        this.tabDepth = depth;
    }
    public abstract process(context: ExecutionContext):Promise<void>;
    public onOpenChildScope(context: ExecutionContext):Stream[] { throw 'statement does not support child scopes'; }
    public onCloseChildScope(context: ExecutionContext, streams: Stream[]) { }
}

abstract class IExpression{
    public abstract Eval(context: ExecutionContext): Promise<Stream>;
    public async EvalAsText(context: ExecutionContext): Promise<string>{
        let out = await this.Eval(context);
        if(out.text == null) throw 'expected expression to evaluate as string, got '+ out.toDisplayText();
        return out.text;
    }
    public async EvalAsMethod(context: ExecutionContext, stream: Stream): Promise<Stream> {throw 'expression is not a method';}
}

function token(match: string):SingleMatch<string> {
    return Match.token(match);
}

function unary(): SingleMatch<string>{
    return Match.anyOf(["!", "-"], false, "unary");
}

function identifier():SingleMatch<string> {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i), false, "ident");
}
function literalNumber():SingleMatch<string> {
    return Match.testToken(t => !isNaN(+t) && isFinite(+t));
}
function literalString():SingleMatch<string> {
    return Match.testToken(t => t[0] === "\""); // shouldn't have lexed anything else with a leading "
}

function expressionLike(stop?: string, optional?: boolean):SingleMatch<string> {
    return Match.testSequence(tokes => {
        const trail = tokes[token.length-1];
        if(stop && trail === stop) return false;
        const lPars = arrCount(tokes, "(");
        const rPars = arrCount(tokes, ")");
        if(lPars < rPars) return false;
        if(lPars > rPars) return null;
        return true;
    }, optional, "exp");
}
function parameterList(optional?: boolean): SingleMatch<string>{
    return Match.testPattern(pattern(
        token("("),
        expressionLike(null, true), // this doesn't seem to actually be optional?
        token(")")
    ), optional, "params");
}

class SMultiStatement extends IStatement{
    __list : IStatement[];
    public constructor(depth: number, list: IStatement[]){
        super(depth);
        this.__list = list;
    }
    public override async process(context: ExecutionContext): Promise<void> {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            await substate.process(context);
        }
    }
}

class SExit extends IStatement{
    public constructor(depth: number){super(depth); }
    public override async process(context: ExecutionContext): Promise<void> {}
}

class SMap extends IStatement{
    public constructor(depth: number){
        super(depth);
    }
    public async process(context: ExecutionContext): Promise<void> {
        if(!context.stream.isArray) throw 'map function expected to process an array';
    }
    public onOpenChildScope(context: ExecutionContext):Stream[]{
        return context.stream.asArray().slice();
    }
    public onCloseChildScope(context: ExecutionContext, streams: Stream[]){
        context.updateStream(Stream.mkArr(streams));
    }
}

class SFilter extends IStatement{
    public constructor(depth: number){
        super(depth);
    }
    public async process(context: ExecutionContext): Promise<void> {
        if(!context.stream.isArray) throw 'filter function expected to process an array';
    }
    public onOpenChildScope(context: ExecutionContext):Stream[]{
        return context.stream.asArray().slice();
    }
    public onCloseChildScope(context: ExecutionContext, streams: Stream[]){
        const prev = context.stream.asArray();
        const filtered = prev.filter((v,i) => streams[i].asBool());
        context.updateStream(Stream.mkArr(filtered));
    }
}

class SSortBy extends IStatement{
    public constructor(depth: number){
        super(depth);
    }
    public async process(context: ExecutionContext): Promise<void> {
        if(!context.stream.isArray) throw 'sortBy command expected to process an array';
    }
    public onOpenChildScope(context: ExecutionContext):Stream[]{
        return context.stream.asArray().slice();
    }
    public onCloseChildScope(context: ExecutionContext, streams: Stream[]){
        const prev = context.stream.asArray();
        let idxes = Object.keys(prev);
        idxes.sort((a,b) => {
            return Stream.Compare(streams[a], streams[b]);
        });
        const sorted = idxes.map(i => prev[i]);
        context.updateStream(Stream.mkArr(sorted));
    }
}

class SStoreLocal extends IStatement{
    __ident: string;
    __exp: IExpression;
    public constructor(depth: number, parse: PatternResult<string>){
        super(depth);
        this.__ident = parse.getSingleKey("ident");
        this.__exp = Parser.tryParseExpression(parse.tryGetByKey("any"));
    }
    public async process(context: ExecutionContext): Promise<void> {
        const result = await this.__exp.Eval(context);
        context.saveVar(this.__ident, result);
    }
}

class SExpression extends IStatement{
    __exp: IExpression;
    public constructor(depth: number, parse: PatternResult<string>){
        super(depth);
        this.__exp = Parser.tryParseExpression(parse.GetSlice());
    }
    public async process(context: ExecutionContext): Promise<void> {
        const result = await this.__exp.Eval(context);
        context.updateStream(result);
    }
}

class SNoop extends IStatement{
    public constructor(depth: number){super(depth);}
    public async process(context: ExecutionContext): Promise<void> {}
}


class EIdentifier extends IExpression{
    name: string;
    public constructor(parse: PatternResult<string>){
        super();
        this.name = parse.getSingleKey("ident");
    }
    public async Eval(context: ExecutionContext): Promise<Stream> {
        let func = _builtInFuncs[this.name];
        if(func != null){
            return await EFunctionCall.runFunc(this.name, [], context, context.stream);
        }
        let obj = context.get(this.name);
        if(obj == null) throw `unknown variable "${this.name}"`;
        return obj;
    }
    public async EvalAsMethod(context: ExecutionContext, stream: Stream): Promise<Stream> {
        let func = _builtInFuncs[this.name];
        if(func != null){
            return await EFunctionCall.runFunc(this.name, [], context, stream);
        }
    }
}

class EStream extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext): Promise<Stream> { return context.stream; }
}
class EIndex extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext): Promise<Stream> { return Stream.mkNum(context.leafNode.index); }
}

class ETrueLiteral extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext): Promise<Stream> { return Stream.mkBool(true); }
}

class EFalseLiteral extends IExpression{
    public constructor(){ super(); }
    public async Eval(context: ExecutionContext): Promise<Stream> { return Stream.mkBool(false); }
}

class ENumericLiteral extends IExpression{
    __num: number;
    public constructor(parse: PatternResult<string>){
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    public async Eval(context: ExecutionContext): Promise<Stream> {
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
    public async Eval(context: ExecutionContext): Promise<Stream> {
        return new Stream(this.__str);
    }
}

class EExpression extends IExpression{
    __inner : IExpression;
    public constructor(parse: PatternResult<string>){
        super();
        let tokes = parse.tryGetByKey("exp");
        this.__inner = Parser.tryParseExpression(tokes);
    }
    public async Eval(context: ExecutionContext): Promise<Stream> {
        return this.__inner.Eval(context);
    }
}

class EUnary extends IExpression{
    __right: IExpression;
    __op: string;

    public constructor(parse: PatternResult<string>){
        super();
        this.__right = Parser.tryParseExpression(parse.tryGetByKey("exp"));
        this.__op = parse.getSingleKey("unary");
    }
    public async Eval(context: ExecutionContext): Promise<Stream> {
        const a = await this.__right.Eval(context);
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
    public async Eval(context: ExecutionContext): Promise<Stream> {
        const a = await this.__left.Eval(context);
        if(this.__op == ":"){
            return await this.__right.EvalAsMethod(context, a);
        }
        const b = await this.__right.Eval(context);
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
    public constructor(parse: PatternResult<string>){
        super();
        this.name = parse.getSingleKey("ident");
        this.params = Parser.tryParseParamList(parse);
    }
    public async Eval(context: ExecutionContext): Promise<Stream> {
        return EFunctionCall.runFunc(this.name, this.params, context, context.stream);
    }
    public static async runFunc(name: string, params: IExpression[], context: ExecutionContext, stream: Stream): Promise<Stream>{
        let func = _builtInFuncs[name];
        if(func == null) throw 'could not find function ' + name;
        if(params.length < func.minP || params.length > func.maxP)
            throw `${name} expected ${func.minP}-${func.maxP} params, got ${params.length}`;
        return await func.action(context, stream, params);
    }
    public async EvalAsMethod(context: ExecutionContext, stream: Stream): Promise<Stream> {
        return await EFunctionCall.runFunc(this.name, this.params, context, stream);
    }
}

const _builtInFuncs: Record<string, IFunction> = {};

regFunc("split", 0, 1, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot split stream - expected string";
    let delim = "\n";
    if(pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkArr(stream.text.split(delim).map(s => new Stream(s)));
});

regFunc("join", 0, 1, async (c, stream, pars) =>{
    if(!stream.isArray) throw "cannot join stream - expected array";
    let delim = "\n";
    if(pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkText(stream.array.map(s => s.asString()).join(delim));
});

regFunc("concat", 1, 1, async (c, stream, pars) =>{
    if(!stream.isArray) throw "cannot concat stream - expected array";
    let tail = (await pars[0].Eval(c)).asArray();
    return Stream.mkArr(stream.array.concat(tail));
});

regFunc("replace", 2, 2, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot replace in stream - expected string";
    const target = await pars[0].EvalAsText(c);
    const replace = await pars[1].EvalAsText(c);
    return Stream.mkText(stream.text.replaceAll(target, replace));
});

regFunc("piece", 2, 2, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot piece stream - expected string";
    const delim = await pars[0].EvalAsText(c);
    const idx = (await pars[1].Eval(c)).asNum();
    const split = stream.asString().split(delim);
    return Stream.mkText(split[idx - 1]);
});

regFunc("contains", 1, 1, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for substring contains - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.includes(target));
});
regFunc("startsWith", 1, 1, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for startsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.startsWith(target));
});
regFunc("endsWith", 1, 1, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for endsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.endsWith(target));
});

regFunc("trim", 0, 0, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trim stream - expected string";
    return Stream.mkText(stream.text.trim());
});
regFunc("trimStart", 0, 0, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trimStart stream - expected string";
    return Stream.mkText(stream.text.trimStart());
});
regFunc("trimEnd", 0, 0, async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trimEnd stream - expected string";
    return Stream.mkText(stream.text.trimEnd());
});

regFunc("modulo", 1, 1, async (c, stream, pars) =>{
    if(!stream.isNum) throw "cannot modulo stream - expected number";
    const m = (await pars[0].Eval(c)).asNum();
    return Stream.mkNum(((stream.num % m) + m) % m);
});

regFunc("slice", 1, 2, async (c, stream, pars) =>{
    if(!stream.isText && !stream.isArray) throw "cannot slice stream - expected string or array";
    const start = (await pars[0].Eval(c)).asNum();
    let end = null;
    if(pars.length > 1) end = (await pars[1].Eval(c)).asNum();
    if(stream.isText)
        return Stream.mkText(stream.asString().slice(start, end));
    return Stream.mkArr(stream.asArray().slice(start, end));
});

regFunc("iif", 2, 3, async (c, stream, pars) =>{
    const test = (await pars[0].Eval(c)).asBool();
    if(test){
        return await pars[1].Eval(c);
    }
    if(pars.length > 2) return await pars[2].Eval(c);
    return stream;
});

regFunc("tryParseNum", 0, 0, async (c, stream, pars) =>{
    if(!stream.isText) return stream;
    const text = stream.asString();
    const flo = parseFloat(text);
    if (isNaN(flo)) return stream;
    return Stream.mkNum(flo);
});

function regFunc(name: string, minP: number, maxP: number, action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>) {
    _builtInFuncs[name] = mkFunc(name, minP, maxP, action);
}

function mkFunc(name: string, minP: number, maxP: number, action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>):IFunction {
    return {name, minP, maxP, action};
}

interface IFunction{
    name: string;
    minP: number;
    maxP: number;
    action: (context: ExecutionContext, stream: Stream, pars: IExpression[]) => Promise<Stream>;
}

function arrCount<T>(arr: T[], elem:T): number
{
    if(arr.length == 0) return 0;
    return arr.map<number>(curr => curr == elem ? 1 : 0).reduce((sum, curr) => sum + curr);
}

function assertParams(pars: IExpression[] | null, min: number, max: number): boolean{
    let len = pars?.length ?? 0;
    if(len < min) throw 'function requires parameters';
    if(len > max) throw 'too many parameters for function';
    return len > 0;
}