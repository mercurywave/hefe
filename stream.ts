
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