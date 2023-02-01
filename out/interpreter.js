export class Interpreter {
}
export class Parser {
    Parse(code) {
        var lines = code.split("\n");
        return lines.map(i => this.ParseLine(i));
    }
    ParseLine(code) {
        throw '';
    }
}
class SIntrinsic {
}
class Expression {
}
class Operator {
}
//# sourceMappingURL=interpreter.js.map