
export class Interpreter{
    
}

export class Parser{
    public Parse(code: string): IStatement[]{
        var lines = code.split("\n");
        return lines.map(i => this.ParseLine(i));
    }
    public ParseLine(code: string): IStatement{
        throw '';
    }
}

interface IStatement{

}

class SIntrinsic{

}

class Expression{

}

class Operator{

}