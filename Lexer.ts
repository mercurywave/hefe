
export class Lexer{
    public static Tokenize(code: string): LexLine{
        return new LexLine(code);
    }
}

export class LexLine{
    public TabDepth: number;

    public constructor(code:string){

    }
}