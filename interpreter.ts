import { Lexer } from "./Lexer.js";
import { Match, Pattern, pattern, PatternResult, SingleMatch, Syntax } from "./patterns.js";

export class Interpreter{
    static __gen = 0;
    public static async Process(input: string, code: IStatement[]): Promise<TransformResult>{
        let state = new InterpreterState(input);
        this.__gen++;
        let currGen = this.__gen;

        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if(step == null) return {output: state.stream, step: state.line, isComplete: false, error: "could not parse line: " + ln};
            state.line = ln;
            try{
                step.process(state);
            } catch(err){
                console.log(err);
                return {output: state.stream, step: state.line, isComplete: false, error: err};
            }
            await new Promise(f => setTimeout(f, 10));
            if(currGen != this.__gen) return null;
        }
        return {output: state.stream, step:  state.line, isComplete: true};
    }
}

export interface TransformResult{
    output: Stream;
    step: number;
    isComplete: boolean;
    error?: string
}

export class InterpreterState{
    __stream: Stream;
    __variables: Record<string, Stream> = {};
    public line: number = -1;

    public get stream() {return this.__stream;}

    public constructor(stream: string){
        this.__stream = new Stream(stream);
    }

    public updateStream(stream: Stream){
        this.__stream = stream;
    }
    public saveVar(name: string, value: Stream){
        this.__variables[name] = value;
    }
    public get(name: string){ return this.__variables[name]; }
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
        this.text = text;
        this.array = array;
        this.num = num;
        this.bool = bool;
    }
    public static mkText(text: string): Stream{ return new Stream(text);}
    public static mkArr(arr: Stream[]): Stream{ return new Stream(null, arr);}
    public static mkNum(num: number): Stream{ return new Stream(null, null, num);}
    public static mkBool(bool: boolean): Stream{ return new Stream(null, null, null, bool);}

    public toDisplayText(nested?:number) : string{
        if(this.text) {
            if(nested > 0) return "\"" + this.text + "\"";
            return this.text;
        }
        if(this.num) return "" + this.num;
        if(this.array) return "[\n" + this.array.map(s => " " + s.toDisplayText((nested ?? 0) + 1)).join(",\n") + "\n]";
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
            case "+":
                if(!other.canCastTo(this.type)) throw 'could not cast right side for +';
                switch (this.type) {
                    case eStreamType.Num: return Stream.mkNum(this.num + other.asNum());
                    case eStreamType.Text: return Stream.mkText(this.text + other.asString());
                    case eStreamType.Array: return Stream.mkArr([].concat(this.array, other.asArray()));
                    default: throw 'types not compatible for +';
                }
            default: throw 'operator ' + op + ' is not implemented';
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
        throw 'cannot cast to number';
    }
    public asBool(): boolean{
        if(this.bool !== null) return this.bool;
        if(this.num !== null) return this.num != 0;
        throw 'cannot cast to number';
    }
    public asArray(): Stream[]{
        if(this.array !== null) return this.array; // caution! original reference!
        throw 'cannot cast to number';
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
        let states: IStatement[] = [];
        let idx = 0;
        let depth = context.getDepth(tokens.TabDepth);
        while(idx < tokens.Tokens.length){
            let match = _statements.firstPartialMatch(tokens.Tokens, idx);
            if(match == null) return null;
            states.push(match.output(depth, match.result));
            idx = match.result.endIndex + 1;
            if(idx < tokens.Tokens.length && tokens[idx] == ">>") idx++;
            else if(idx < tokens.Tokens.length) return null;
        }
        let result: IStatement;
        if(states.length == 0) result = null;
        else if(states.length == 1) result = states[0];
        else result = new SMultiStatement(depth, states);
        return result;
    }

    public static tryParseParamList(parse: PatternResult<string>, key?: string): IExpression[] | null{
        let tokes = parse?.tryGetByKey(key ?? "params");
        if(tokes == null) return null;
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
                if(stack.length == 1) outputs.push(stack[0]);
                else{
                    outputs.push(EOperator.SplitEquation(stack, ops));
                    stack = [];
                    ops = [];
                }
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
            if(state.tabDepth < tabDepth) {
                count++;
                tabDepth = state.tabDepth;
            }
        }
        return count;
    }
}

type StatementGenerator = (depth: number, result: PatternResult<string>) => IStatement;
const _statements = new Syntax<string, StatementGenerator>()
    .add([token("split"), parameterList(true)], (dep, res) => new SSplit(dep, res))
;

type ExpressionGenerator = (result: PatternResult<string>) => IExpression;
// should not include operators -- need to avoid infinite/expensive parsing recursion
const _expressionComps = new Syntax<string, ExpressionGenerator>()
    .add([identifier()],res => new EIdentifier(res))
    .add([literalNumber()], res => new ENumericLiteral(res))
    .add([literalString()], res => new EStringLiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res))
;

abstract class IStatement{
    tabDepth: number;
    public constructor(depth: number){
        this.tabDepth = depth;
    }
    public abstract process(state: InterpreterState);
}

abstract class IExpression{
    public abstract Eval(state: InterpreterState): Stream;
    public EvalAsText(state: InterpreterState){
        let out = this.Eval(state);
        if(out.text == null) throw 'expected expression to evaluate as string, got '+ out.toDisplayText();
        return out.text;
    }
}

function token(match: string):SingleMatch<string> {
    return Match.token(match);
}

function identifier():SingleMatch<string> {
    return Match.testToken(t => t.match(/^[$A-Z_][0-9A-Z_$]*$/i));
}
function literalNumber():SingleMatch<string> {
    return Match.testToken(t => !isNaN(+t) && isFinite(+t));
}
function literalString():SingleMatch<string> {
    return Match.testToken(t => t[0] === "\""); // shouldn't have lexed anything else with a leading "
}

function expressionLike(stop?: string):SingleMatch<string> {
    return Match.testSequence(tokes => {
        const trail = tokes[token.length-1];
        if(stop && trail === stop) return false;
        const lPars = arrCount(tokes, "(");
        const rPars = arrCount(tokes, ")");
        if(lPars < rPars) return false;
        if(lPars > rPars) return null;
        return true;
    }, "exp");
}
function parameterList(optional?: boolean): SingleMatch<string>{
    return Match.testPattern(pattern(
        token("("),
        expressionLike(),
        token(")")
    ), optional, "params");
}

class SMultiStatement extends IStatement{
    __list : IStatement[];
    public constructor(depth: number, list: IStatement[]){
        super(depth);
        this.__list = list;
    }
    public override process(state: InterpreterState) {
        for (let index = 0; index < this.__list.length; index++) {
            const substate = this.__list[index];
            substate.process(state);
        }
    }
}

class SSplit extends IStatement{
    __exp: IExpression;
    public constructor(depth: number, parse: PatternResult<string>){
        super(depth);
        var pars = Parser.tryParseParamList(parse);
        if(assertParams(pars, 0, 1))
            this.__exp = pars[0];
    }
    public process(state: InterpreterState) {
        if(state.stream.text === null) throw "cannot split stream - expected string";
        let delim = "\n";
        if(this.__exp) delim = this.__exp.EvalAsText(state);
        state.updateStream(new Stream(null, state.stream.text.split(delim).map(s => new Stream(s))));
    }
}


class EIdentifier extends IExpression{
    public constructor(parse: PatternResult<string>){
        super();
    }
    public Eval(state: InterpreterState): Stream {
        throw '';
    }
}

class ENumericLiteral extends IExpression{
    __num: number;
    public constructor(parse: PatternResult<string>){
        super();
        this.__num = Number.parseFloat(parse.PullOnlyResult());
    }
    public Eval(state: InterpreterState): Stream {
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
    public Eval(state: InterpreterState): Stream {
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
    public Eval(state: InterpreterState): Stream {
        return this.__inner.Eval(state);
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
            const aa = EOperator.OpPriority(ops[a]);
            const bb = EOperator.OpPriority(ops[b]);
            if(aa == bb) return 0;
            if(aa > bb) return 1;
            if(aa < bb) return -1;
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
    public Eval(state: InterpreterState): Stream {
        const a = this.__left.Eval(state);
        const b = this.__right.Eval(state);
        return a.runOp(this.__op, b);
    }
    public static IsOperator(op: string): boolean{
        switch (op) {
            case "!=":
                return true;
            default: return "+-=*/&|<>".includes(op);
        }
    }
    public static OpPriority(op: string): number{
        // this is complicated, and will rarely matter...
        throw 'not implemented';
    }
}

function arrCount<T>(arr: T[], elem:T): number
{
    return arr.map<number>(curr => curr == elem ? 1 : 0).reduce((sum, curr) => sum + curr);
}

function assertParams(pars: IExpression[] | null, min: number, max: number): boolean{
    let len = pars?.length ?? 0;
    if(len < min) throw 'function requires parameters';
    if(len > max) throw 'too many parameters for function';
    return len > 0;
}