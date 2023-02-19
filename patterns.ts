

export function pattern<T>(...patterns: SingleMatch<T>[]):Pattern<T> {
    return new Pattern<T>(patterns);
}

export module Match{
    export function token<T>(match: T, optional?: boolean, key?: string):SingleMatch<T> {
        return testToken(t => t === match, optional, key ?? "tok");
    }
    export function anyOf<T>(matches: T[], optional?: boolean, key?: string):SingleMatch<T>{
        return testToken(t => matches.includes(t), optional, key ?? "anyOf");
    }
    export function anything<T>(optional?: boolean): SingleMatch<T>{
        // always includes the rest of the stream. does not stop for nothing
        return matchWhile(t => true, optional, "any");
    }
    export function testToken<T>(match: (T) => boolean, optional?: boolean, key?: string):SingleMatch<T> {
        return {
            Optional: !!optional,
            Handler: (t,b) =>{
                return result(match(t[b]), b, 1, key ?? "ttok");
            },
        };
    }
    
    export function sequences<T>(sequences: T[][], key?: string):SingleMatch<T>{
        return {
            Optional: false,
            Handler: (t,b) =>{
                for (const seq of sequences) {   
                    let exact = true;
                    for (let index = 0; index + b < t.length && index < seq.length; index++) {
                        exact &&= (t[index + b] == seq[index]);
                    }
                    if(exact)
                        return result(exact, b, seq.length, key ?? "seq");
                }
                return result(false, b, 0, key);
            },
        };
    }

    // minimum 1
    export function matchWhile<T>(matcher: (toke: T) => boolean, optional?: boolean, key?: string):SingleMatch<T>{
        return matchWhileAt((tokes,idx) => matcher(tokes[idx]), optional, key);
    }

    export function matchWhileAt<T>(matcher: (tokes: T[], idx: number) => boolean, optional?: boolean, key?: string):SingleMatch<T>{
        return {
            Optional: optional,
            Handler: (t,b) =>{
                let index = 0;
                for (; index + b < t.length; index++) {
                    if(!matcher(t, b + index)) { break; }
                }
                return result(index > 0, b, index, key ?? "while");
            },
        };
    }

    // test increasingly long sequences - not efficient
    export function testSequence<T>(matcher: (tokes: T[]) => boolean | null, optional?: boolean, key?: string):SingleMatch<T>{
        return {
            Optional: optional,
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

    export function testRemainder<T>(matcher: (tokes: T[]) => boolean | null, optional?: boolean, key?: string):SingleMatch<T>{
        return {
            Optional: optional,
            Handler: (t,b) =>{
                let slice = t.slice(b);
                return result(matcher(slice), b, slice.length, key ?? "trem");
            },
        };
    }

    export function testPattern<T>(pattern: Pattern<T>, optional?: boolean, key?: string):SingleMatch<T>{
        return {
            Optional: optional,
            Handler: (t,b) =>{
                let res = pattern.testPartial(t, b);
                return result(res?.isSuccess, res?.startIndex, res?.length, key ?? "patt");
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
    public testPartial(tokens: T[], fromIdx: number): PatternResult<T> | null {
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
        return new PatternResult(tokens, matches);
    }
    
    // fails if there are any trailing characters
    public testWhole(tokens: T[], fromIdx: number): PatternResult<T> | null {
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

export class PatternResult<T>{
    __tokens: T[]; // tokens are the whole list, not just the relevant one
    Matches?: MatchResult[];
    public constructor(tokens: T[], matches?: MatchResult[]){
        this.__tokens = tokens;
        this.Matches = matches;
    }
    public get isSuccess():boolean { return this.Matches != null; }
    public get length(): number {
        return this.endIndex - this.startIndex + 1;
    }
    public get startIndex():number { 
        return Math.min(... this.Matches?.map(m => m.Begin) ?? [-1]);
    }
    public get endIndex():number { 
        return Math.max(... this.Matches?.map(m => m.Begin + m.Length - 1) ?? [-1]);
    }
    public GetSlice(): T[]{
        return this.__tokens?.slice(this.startIndex, this.startIndex + this.length) ?? [];
    }
    public PullOnlyResult(): T{
        if(this.length != 1) throw 'PullOnlyResult expected to find a single result';
        return this.__tokens[this.startIndex];
    }
    public tryGetByKey(key: string) : T[] | null{
        for (const mtch of this.Matches) {
            if(mtch.Key === key && mtch.Match) return this.__tokens.slice(mtch.Begin, mtch.Begin + mtch.Length);
        }
        return null;
    }
    public getSingleKey(key: string) : T{
        for (const mtch of this.Matches) {
            if(mtch.Key === key && mtch.Match) {
                if(mtch.Length != 1) throw `"${key}" found too many tokens?`;
                return this.__tokens[mtch.Begin];
            }
        }
        throw `no match for "${key}"`
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
    public addMulti(source: Syntax<T,V>): Syntax<T,V>{
        for (const pat of source.maps) {
            this.maps.push(pat);
        }
        return this;
    }
    public add(matches: SingleMatch<T>[], out:V): Syntax<T,V>{
        this.maps.push( {
            test: new Pattern<T>(matches),
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
    result: PatternResult<T>;
    index: number;
    output: V;
}