export function pattern(...patterns) {
    return new Pattern(patterns);
}
export var Match;
(function (Match) {
    function token(match, optional, key) {
        return testToken(t => t === match, optional, key ?? "tok");
    }
    Match.token = token;
    function anyOf(matches, optional, key) {
        return testToken(t => matches.includes(t), optional, key ?? "anyOf");
    }
    Match.anyOf = anyOf;
    function testToken(match, optional, key) {
        return {
            Optional: !!optional,
            Handler: (t, b) => {
                return result(match(t[b]), b, 1, key ?? "ttok");
            },
        };
    }
    Match.testToken = testToken;
    function sequences(sequences, key) {
        return {
            Optional: false,
            Handler: (t, b) => {
                for (const seq of sequences) {
                    let exact = true;
                    for (let index = 0; index + b < t.length && index < seq.length; index++) {
                        exact && (exact = t[index + b] == seq[index]);
                    }
                    if (exact)
                        return result(exact, b, seq.length, key ?? "seq");
                }
                return result(false, b, 0, key);
            },
        };
    }
    Match.sequences = sequences;
    // minimum 1
    function matchWhile(matcher, key) {
        return matchWhileAt((tokes, idx) => matcher(tokes[idx]), key);
    }
    Match.matchWhile = matchWhile;
    function matchWhileAt(matcher, key) {
        return {
            Optional: false,
            Handler: (t, b) => {
                let index = 0;
                for (; index + b < t.length; index++) {
                    if (!matcher(t, b + index)) {
                        break;
                    }
                }
                return result(index > 0, b, index, key ?? "while");
            },
        };
    }
    Match.matchWhileAt = matchWhileAt;
    // test increasingly long sequences - not efficient
    function testSequence(matcher, key) {
        return {
            Optional: false,
            Handler: (t, b) => {
                let index = 0;
                for (; index + b < t.length; index++) {
                    const sub = t.slice(b, b + index + 1);
                    if (matcher(sub) === false) {
                        break;
                    }
                }
                if (matcher(t.slice(b, b + index)) !== true) {
                    index = 0;
                }
                return result(index > 0, b, index, key ?? "tseq");
            },
        };
    }
    Match.testSequence = testSequence;
    function testPattern(pattern, optional, key) {
        return {
            Optional: optional,
            Handler: (t, b) => {
                let res = pattern.testPartial(t, b);
                return result(res?.isSuccess, res?.startIndex, res?.length, key ?? "patt");
            },
        };
    }
    Match.testPattern = testPattern;
})(Match || (Match = {}));
export class Pattern {
    constructor(matches) {
        this.Matches = matches;
    }
    // null if no match. no guarantee we've reached the end
    testPartial(tokens, fromIdx) {
        let matches = [];
        for (let i = 0; i < this.Matches.length; i++) {
            const test = this.Matches[i];
            let res = test.Handler(tokens, fromIdx);
            if (!res.Match && !test.Optional)
                return null;
            if (res.Match) {
                matches.push(res);
                fromIdx += res.Length;
            }
        }
        return new PatternResult(tokens, matches);
    }
    // fails if there are any trailing characters
    testWhole(tokens, fromIdx) {
        var res = this.testPartial(tokens, fromIdx);
        if (res.length + fromIdx < tokens.length) {
            return null;
        }
        return res;
    }
}
function result(match, begin, length, key) {
    return { Match: match, Begin: begin, Length: length, Key: key };
}
export class PatternResult {
    constructor(tokens, matches) {
        this.__tokens = tokens;
        this.Matches = matches;
    }
    get isSuccess() { return this.Matches != null; }
    get length() {
        return this.endIndex - this.startIndex + 1;
    }
    get startIndex() {
        return Math.min(...this.Matches?.map(m => m.Begin) ?? [-1]);
    }
    get endIndex() {
        return Math.max(...this.Matches?.map(m => m.Begin + m.Length - 1) ?? [-1]);
    }
    GetSlice() {
        return this.__tokens?.slice(this.startIndex, this.startIndex + this.length) ?? [];
    }
    PullOnlyResult() {
        if (this.length != 1)
            throw 'PullOnlyResult expected to find a single result';
        return this.__tokens[this.startIndex];
    }
    tryGetByKey(key) {
        for (const mtch of this.Matches) {
            if (mtch.Key === key && mtch.Match)
                return this.__tokens.slice(mtch.Begin, mtch.Begin + mtch.Length);
        }
        return null;
    }
}
export class Syntax {
    constructor(maps) {
        this.maps = maps ?? [];
    }
    add(matches, out) {
        this.maps.push({
            test: new Pattern(matches),
            output: out
        });
        return this;
    }
    testPartial(tokens, fromIdx) {
        var result = this.firstPartialMatch(tokens, fromIdx);
        if (result == null) {
            return null;
        }
        return this.maps[result.index].output;
    }
    firstPartialMatch(tokens, fromIdx) {
        for (let index = 0; index < this.maps.length; index++) {
            const pattern = this.maps[index];
            var result = pattern.test.testPartial(tokens, fromIdx);
            if (result?.isSuccess) {
                return { pattern: pattern.test, result, index, output: this.maps[index].output };
            }
        }
        return null;
    }
}
//# sourceMappingURL=patterns.js.map