import { ICanHaveScope, IStatement, Parser, SExit, SNoop } from "./parser.js";
import { Stream } from "./stream.js";

export interface InputContext{
    text: string;
    fileName: string;
}

export class Interpreter{
    static __gen = 0;
    public static async Process(input: InputContext, code: IStatement[]): Promise<TransformResult>{
        let state = new InterpreterState(input.text);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        this.__gen++;
        let currGen = this.__gen;
        let lastScope:IStatement | null = null;

        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if(step instanceof SNoop) continue;
            if(step == null) return {output: state.exportAsStream(), step: state.line, isComplete: false, error: "could not parse line: " + ln};
            state.line = ln;
            if(step.tabDepth + 1 > state.depth && lastScope)
                state.pushStack(lastScope);
            while(state.depth > step.tabDepth + 1)
                state.popStack();
            if(step instanceof SExit) return {output: state.exportAsStream(), step:  state.line, isComplete: true};
            try{
                await Interpreter.parallelProcess(state, 0, step);
            } catch(err){
                return {output: state.exportAsStream(), step: state.line, isComplete: false, error: err};
            }
            lastScope = step;
            await new Promise(f => setTimeout(f, 1));
            if(currGen != this.__gen) return null;
        }
        while(state.depth > 1)
            state.popStack();
        return {output: state.exportAsStream(), step:  state.line, isComplete: true};
    }
    
    static async parallelProcess(state: InterpreterState, depth: number, child: IStatement): Promise<void>{
        let futures: Promise<void>[] = [];
        state.foreachExecution(context => futures.push(child.process(context)) );
        await Promise.all(futures);
    }

    public static getBuiltinSymbols(): string[]{
        return Parser.getBuiltInsSymbols();
    }
}

export interface TransformResult{
    output: Stream;
    step: number;
    isComplete: boolean;
    error?: string
}

export class ExecutionContext{
    __currBranch: StackBranch[];
    __state: InterpreterState;

    public constructor(currBranch: StackBranch[], state: InterpreterState){
        this.__currBranch = currBranch;
        this.__state = state;
    }

    public get stream(): Stream { return this.leafNode.stream;}
    public get leafNode(): StackBranch { return this.__currBranch[this.__currBranch.length - 1]; }

    public updateStream(stream: Stream){
        var stack = this.leafNode;
        stack.stream = stream;
    }
    public saveVar(name: string, value: Stream){
        this.leafNode.set(name, value);
    }
    public get(name: string): Stream | null{
        for(let idx = this.__currBranch.length - 1; idx >= 0; idx--){
            const obj = this.__currBranch[idx].get(name);
            if(obj != null) return obj;
        }
        return null;
    }
}

export class InterpreterState{
    __root: StackBranch;
    __scopes: IStatement[] = [null];
    public line: number = -1;

    public constructor(stream: string){
        this.__root = new StackBranch(Stream.mkText(stream), 0);
    }

    public get depth(): number {return this.__scopes.length;}

    public foreachExecution(action: (context: ExecutionContext) => void, depth?: number){
        this.foreachChain((c) => action(new ExecutionContext(c, this)));
    }
    foreachChain(action: (chain: StackBranch[], leaf: StackBranch) => void, depth?: number){
        this.chainIterHelper(action, this.__root, [this.__root], depth ?? (this.depth - 1));
    }
    chainIterHelper(action: (chain: StackBranch[], leaf: StackBranch) => void, node: StackBranch, chain: StackBranch[], depth: number){
        if(depth == 0){
            action(chain, node);
        }
        else {
            for (const branch of node.__branches) {
                this.chainIterHelper(action, branch, chain.slice().concat(branch), depth - 1);
            }
        }
    }

    public pushStack(state: IStatement){
        if (!(state instanceof ICanHaveScope)) throw 'inner scope is unexpected';
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const streams = state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        });
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    public popStack(){
        let owner = this.__scopes.pop();
        // since we popped, the leafs have branches
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const branches = leaf.branches.map(b => b.stream);
            let result = (owner as ICanHaveScope).onCloseChildScope(context, branches);
            context.updateStream(result);
            leaf.branches = null;
        });
    }

    public exportAsStream(): Stream{
        if(this.depth == 1)
            return this.__root.stream;
        let streams: Stream[] = [];
        this.foreachChain((c,l) => streams.push(l.stream));
        if(streams.length == 1) return streams[0];
        return Stream.mkArr(streams);
    }

    public setGlobalVal(name: string, value: Stream){
        this.__root.set(name, value);
    }
}

class StackBranch{
    __stream: Stream;
    __branches: StackBranch[];
    variables: Record<string, Stream> = {};
    index: number;
    public constructor(stream: Stream, index: number){
        this.__stream = stream;
        this.index = index;
    }
    public get(name: string): Stream | null{
        return this.variables[name];
    }
    public set(name: string, value: Stream){
        this.variables[name] = value;
    }
    public get stream(): Stream { return this.__stream; }
    public set stream(stream: Stream) { this.__stream = stream; }
    public set branches(leafs: StackBranch[]) {this.__branches = leafs;}
    public get branches(): StackBranch[] { return this.__branches; }
    public addBranch(leaf: StackBranch) {
        if(this.__branches == null)
            this.__branches = [];
        this.__branches.push(leaf);
    }
}