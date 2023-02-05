import { Lexer } from "./Lexer.js";
import { Match, Pattern, pattern, PatternResult, SingleMatch, Syntax } from "./patterns.js";

export class Interpreter{
    static __gen = 0;
    public static async Process(stream: string, code: IStatement[]): Promise<TransformResult>{
        let currStep = stream;
        this.__gen++;
        let currGen = this.__gen;

        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if(step == null) return {output: currStep, step: ln - 1};
            
            await new Promise(f => setTimeout(f, 10));
            if(currGen != this.__gen) return null;
        }
        return {output: currStep, step: code.length};
    }
}

export interface TransformResult{
    output: string;
    step: number;
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
            let match = _statements.firstPartialMatch(tokens.Tokens, 0);
            if(match == null) return null;
            idx = match.result.endIndex + 1;
            if(idx >= tokens.Tokens.length) break;
            if(tokens[idx] == ">>") idx++;
            //else if (tokens[idx] == )
            else return null;
            states.push(match.output(depth, match.result));
        }
        let result: IStatement;
        if(states.length === 0) result = null;
        if(states.length === 1) result = states[0];
        else result = new SMultiStatement(depth, states);
        return result;
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
const _expressionComps = new Syntax<string, ExpressionGenerator>()
    .add([identifier()],res => new EIdentifier(res))
    .add([literalNumber()], res => new ELiteral(res))
    .add([literalString()], res => new ELiteral(res))
    .add([token("("), expressionLike(), token(")")], res => new EExpression(res))
;

abstract class IStatement{
    tabDepth: number;
    public constructor(depth: number){
        this.tabDepth = depth;
    }
}

abstract class IExpression{

}

class SIntrinsic{

}

class Expression{

}

class Operator{

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
    });
}
function parameterList(optional?: boolean): SingleMatch<string>{
    return Match.testPattern(pattern(
        token("("),
        expressionLike(),
        token(")")
    ), optional, "params");
}

class SMultiStatement extends IStatement{
    public constructor(depth: number, list: IStatement[]){
        super(depth);
    }
}

class SSplit extends IStatement{
    public constructor(depth: number, parse: PatternResult<string>){
        super(depth);
    }
}

class EIdentifier extends IExpression{
    public constructor(parse: PatternResult<string>){
        super();
    }
}

class ELiteral extends IExpression{
    public constructor(parse: PatternResult<string>){
        super();
    }
}

class EExpression extends IExpression{
    public constructor(parse: PatternResult<string>){super();}
}

function arrCount<T>(arr: T[], elem:T): number
{
    return arr.map<number>(curr => curr == elem ? 1 : 0).reduce((sum, curr) => sum + curr);
}