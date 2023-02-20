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
            case "!": return Stream.mkBool(!this.asBool());
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
        throw 'cannot cast to string';
    }
    asBool() {
        if (this.bool !== null)
            return this.bool;
        if (this.num !== null)
            return this.num != 0;
        throw 'cannot cast to bool';
    }
    asArray() {
        if (this.array !== null)
            return this.array; // caution! original reference!
        throw 'cannot cast to array';
    }
    get isNum() { return this.num !== null; }
    get isText() { return this.text !== null; }
    get isBool() { return this.bool !== null; }
    get isArray() { return this.array !== null; }
    static Compare(a, b) {
        if (a === b)
            return 0;
        if (a == null)
            return -1;
        if (b == null)
            return 1;
        if (a.isNum && b.isNum)
            return a.num - b.num;
        if (a.isText && b.isText)
            return a.asString().localeCompare(b.asString());
        if (a.isBool && b.isBool)
            return (a.asBool() ? 1 : -1) + (b.asBool() ? -1 : 1);
        if (a.isArray && b.isArray) {
            for (let i = 0; i < a.array.length && i < b.array.length; i++) {
                const comp = Stream.Compare(a.array[i], b.array[i]);
                if (comp != 0)
                    return comp;
            }
            if (a.array.length > b.array.length)
                return 1;
            if (a.array.length < b.array.length)
                return -1;
            return 0;
        }
        if (a.isNum)
            return 1;
        if (b.isNum)
            return -1;
        if (a.isText)
            return 1;
        if (b.isText)
            return -1;
        if (a.isBool)
            return 1;
        if (b.isBool)
            return -1;
        throw 'unreachable comparison reached';
    }
}
//# sourceMappingURL=stream.js.map