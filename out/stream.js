export var eStreamType;
(function (eStreamType) {
    eStreamType[eStreamType["Text"] = 0] = "Text";
    eStreamType[eStreamType["Num"] = 1] = "Num";
    eStreamType[eStreamType["Bool"] = 2] = "Bool";
    eStreamType[eStreamType["Array"] = 3] = "Array";
    eStreamType[eStreamType["Map"] = 4] = "Map";
})(eStreamType || (eStreamType = {}));
export class Stream {
    constructor(text, array, num, bool, map) {
        this.text = text ?? null;
        this.array = array ?? null;
        this.num = num ?? null;
        this.bool = bool ?? null;
        this.map = map ?? null;
    }
    static mkText(text) { return new Stream(text); }
    static mkArr(arr) { return new Stream(null, arr); }
    static mkNum(num) { return new Stream(null, null, num); }
    static mkBool(bool) { return new Stream(null, null, null, bool); }
    static mkMap(map) { return new Stream(null, null, null, null, map); }
    copy() {
        return new Stream(this.text, this.array?.slice(), this.num, this.bool, this.map);
    }
    toDisplayText(nested) {
        nested ??= 0;
        const next = nested + 1;
        const indent = "".padStart(nested * 2, " ");
        const subIndent = indent + "  ";
        if (this.isText) {
            if (nested > 0)
                return "\"" + this.text.replaceAll("\n", "\n" + indent) + "\"";
            return this.text;
        }
        if (this.isNum)
            return "" + this.num;
        if (this.isBool)
            return "" + this.bool;
        if (this.isArray)
            return "[\n" + this.array.map(s => subIndent + s.toDisplayText(next)).join(",\n") + "\n" + indent + "]";
        if (this.isMap) {
            let arr = [];
            for (let pair of this.map.entries()) {
                let key = (typeof pair[0] === 'string') ? '"' + pair[0] + '"' : pair[0];
                arr.push(key + " : " + pair[1].toDisplayText(next));
            }
            return '{\n' + subIndent + arr.join(",\n" + subIndent) + "\n" + indent + "}";
        }
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
        if (a.map != null)
            throw 'map comparison not implemented';
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
        if (this.map !== null)
            return eStreamType.Map;
        throw 'unknown type';
    }
    canCastTo(type) {
        switch (type) {
            case eStreamType.Array: return [eStreamType.Array].includes(type);
            case eStreamType.Bool: return [eStreamType.Bool, eStreamType.Num].includes(type);
            case eStreamType.Num: return [eStreamType.Num].includes(type);
            case eStreamType.Text: return [eStreamType.Text, eStreamType.Num, eStreamType.Bool].includes(type);
            case eStreamType.Map: return [eStreamType.Map].includes(type);
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
        return this.text ?? this.num ?? this.bool ?? this.array ?? this.map;
    }
    canBeKey() { return this.isNum || this.isText || this.isBool; }
    toKey() {
        if (this.canBeKey())
            return this.num ?? this.text ?? this.bool;
        throw 'stream is not a valid key for mapping';
    }
    static fromRaw(val) {
        switch (typeof val) {
            case "string": return this.mkText(val);
            case "number": return this.mkNum(val);
            case "boolean": return this.mkBool(val);
            default:
                if (val == null)
                    throw new Error('did not expect null stream');
                if (Array.isArray(val))
                    return this.mkArr(val);
                if (val instanceof Map)
                    return this.mkMap(val);
                throw new Error(`could not create stream from ${val}`);
        }
    }
    static fromObj(obj) {
        // from a JSON-like object
        switch (typeof obj) {
            case "string": return this.fromRaw(obj);
            case "number": return this.fromRaw(obj);
            case "boolean": return this.fromRaw(obj);
        }
        if (obj == null)
            throw new Error('did not expect null stream');
        if (Array.isArray(obj)) {
            return this.mkArr(obj.map(c => this.fromObj(c)));
        }
        var stream = this.mkMap(new Map());
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                var iKey = this.mkText(key).toKey();
                let child = this.fromObj(obj[key]);
                stream.map.set(iKey, child);
            }
        }
        return stream;
    }
    asNum() {
        if (this.num !== null)
            return this.num;
        if (this.text !== null) {
            const flo = parseFloat(this.text);
            if (isNaN(flo))
                return flo;
        }
        throw new Error(`cannot cast '${this.toDisplayText()}' to number`);
    }
    asString() {
        if (this.text !== null)
            return this.text;
        if (this.num !== null)
            return "" + this.num;
        if (this.bool !== null)
            return "" + this.bool;
        throw new Error(`cannot cast '${this.toDisplayText()}' to string`);
    }
    asBool() {
        if (this.bool !== null)
            return this.bool;
        if (this.num !== null)
            return this.num != 0;
        if (this.text?.toLowerCase() == 'true')
            return true;
        if (this.text?.toLowerCase() == 'false')
            return false;
        throw new Error(`cannot cast '${this.toDisplayText()}' to bool`);
    }
    asArray() {
        if (this.array !== null)
            return this.array; // caution! original reference!
        throw new Error(`cannot cast '${this.toDisplayText()}' to array`);
    }
    asMap() {
        if (this.isMap)
            return this.map;
        throw new Error(`cannot cast '${this.toDisplayText()}' to map`);
    }
    get isNum() { return this.num !== null; }
    get isText() { return this.text !== null; }
    get isBool() { return this.bool !== null; }
    get isArray() { return this.array !== null; }
    get isMap() { return this.map !== null; }
    // returns array of [key, value] arrays
    mapToPairsArr() {
        let map = this.asMap();
        let keys = Array.from(map.keys());
        return keys.map(k => Stream.mkArr([Stream.fromRaw(k), map.get(k)]));
    }
    getChild(idx) {
        if (this.isArray)
            return this.asArray()[idx.asNum()];
        if (this.isMap) {
            const key = idx.toKey();
            return this.asMap().get(key) ?? new Stream();
        }
        throw `Cannot retrieve child '${idx.toDisplayText()}' of ${this.type}`;
    }
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
        if (a.isMap || b.isMap) {
            throw 'cannot compare map objects';
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
        throw `could not compare objects of types ${a.type} and ${b.type}`;
    }
}
//# sourceMappingURL=stream.js.map