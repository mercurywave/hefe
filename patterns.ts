

export function pattern<T>(...patterns: SingleMatch<T>[]):Pattern<T> {
    return new Pattern<T>(patterns);
}

export module Match{
    export function token<T>(match: T, optional?: boolean, key?: string):SingleMatch<T> {
        return {
            Optional: !!optional,
            Handler: (t,b) =>{
                return result(t[b] == match, b, 1, key ?? "tok");
            },
        };
    }
    export function anyOf<T>(matches: T[], key?: string):SingleMatch<T>{
        return {
            Optional: false,
            Handler: (t,b) => {
                return result(matches.includes(t[b]), b, 1, key ?? "toks");
            },
        };
    }
    
    export function sequence<T>(seq: T[], key?: string):SingleMatch<T>{
        return {
            Optional: false,
            Handler: (t,b) =>{
                let exact = true;
                for (let index = 0; index + b < t.length && index < seq.length; index++) {
                    exact &&= (t[index + b] == seq[index]);
                }
                return result(exact, b, seq.length, key ?? "seq");
            },
        };
    }

    // minimum 1
    export function matchWhile<T>(matcher: (toke: T) => boolean, key?: string):SingleMatch<T>{
        return {
            Optional: false,
            Handler: (t,b) =>{
                let index = 0;
                for (; index + b < t.length; index++) {
                    if(!matcher(t[index])) { break; }
                }
                return result(index > 0, b, index, key ?? "while");
            },
        };
    }

    // test increasingly long sequences - not efficient
    export function testSequence<T>(matcher: (tokes: T[]) => boolean | null, key?: string):SingleMatch<T>{
        return {
            Optional: false,
            Handler: (t,b) =>{
                let index = 0;
                for (; index + b < t.length; index++) {
                    const sub = t.slice(b, b + index + 1);
                    if(matcher(sub) === false) { break; }
                }
                if(matcher(t.slice(b, b + index)) !== true) { index = 0; }
                return result(index > 0, b, index, key ?? "tseq");
            },
        };
    }
}


export class Pattern<T>{
    public Matches: SingleMatch<T>[];
    public constructor(matches: SingleMatch<T>[]){
        this.Matches = matches;
    }

    // null if no match. no guarantee we've reached the end
    public testPartial(tokens: T[], fromIdx: number): PatternResult | null {
        let matches: MatchResult[] = [];
        for (let i = 0; i < this.Matches.length; i++) {
            const test = this.Matches[i];
            let res = test.Handler(tokens, fromIdx);
            if(!res.Match && !test.Optional) return null;
            if (res.Match){
                matches.push(res);
                fromIdx += res.Length;
            } 
        }
        return new PatternResult(matches);
    }
    
    // fails if there are any trailing characters
    public testWhole(tokens: T[], fromIdx: number): PatternResult | null {
        var res = this.testPartial(tokens, fromIdx);
        if(res.length + fromIdx < tokens.length) { return null; }
        return res;
    }
}

type MatchHandler<T> = (Tokens: T[], Begin: number) => MatchResult;

export interface SingleMatch<T>{
    Handler: MatchHandler<T>;
    Optional: boolean;
}

function result(match: boolean, begin: number, length: number, key?: string): MatchResult{
    return { Match: match, Begin: begin, Length: length, Key: key };
}
interface MatchResult{
    Match: boolean;
    Begin: number;
    Length: number;
    Key?: string;
}

class PatternResult{
    Matches?: MatchResult[];
    public constructor(matches?: MatchResult[]){
        this.Matches = matches;
    }
    public get isSuccess():boolean { return this.Matches != null; }
    public get length(): number {
        return this.Matches?.map(m => m.Length).reduce((sum,curr) => sum + curr) ?? 0;
    }
}

interface PatternMap<T,V>{
    test: Pattern<T>;
    output: V;
}

export class Syntax<T,V>{
    maps: PatternMap<T,V>[];
    public constructor(maps?: PatternMap<T,V>[]){
        this.maps = maps ?? [];
    }
    public add(match, out): Syntax<T,V>{
        this.maps.push( {
            test: match,
            output: out
        } );
        return this;
    }

    public testPartial(tokens: T[], fromIdx: number):V | null{
        var result = this.firstPartialMatch(tokens, fromIdx);
        if(result == null) { return null; }
        return this.maps[result.index].output;
    }

    public firstPartialMatch(tokens: T[], fromIdx: number): SyntaxMatch<T, V>{
        for (let index = 0; index < this.maps.length; index++) {
            const pattern = this.maps[index];
            var result = pattern.test.testPartial(tokens, fromIdx);
            if(result?.isSuccess) {
                return {pattern: pattern.test, result, index, output: this.maps[index].output};
            }
        }
        return null;
    }
}

interface SyntaxMatch<T,V>{
    pattern: Pattern<T>;
    result: PatternResult;
    index: number;
    output: V;
}