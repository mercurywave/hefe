import { ICanHaveScope, Parser, SExit, SNoop } from "./parser.js";
import { Stream } from "./stream.js";
export class Interpreter {
    static async Process(input, code) {
        let state = new InterpreterState(input.text);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        this.__gen++;
        let currGen = this.__gen;
        let lastScope = null;
        for (let ln = 0; ln < code.length; ln++) {
            const step = code[ln];
            if (step instanceof SNoop)
                continue;
            if (step == null)
                return { output: state.exportAsStream(), step: state.line, isComplete: false, error: "could not parse line: " + ln };
            state.line = ln;
            if (step.tabDepth + 1 > state.depth && lastScope)
                state.pushStack(lastScope);
            while (state.depth > step.tabDepth + 1)
                state.popStack();
            if (step instanceof SExit)
                return { output: state.exportAsStream(), step: state.line, isComplete: true };
            try {
                await Interpreter.parallelProcess(state, 0, step);
            }
            catch (err) {
                return { output: state.exportAsStream(), step: state.line, isComplete: false, error: err };
            }
            lastScope = step;
            await new Promise(f => setTimeout(f, 1));
            if (currGen != this.__gen)
                return null;
        }
        while (state.depth > 1)
            state.popStack();
        return { output: state.exportAsStream(), step: state.line, isComplete: true };
    }
    static async parallelProcess(state, depth, child) {
        let futures = [];
        state.foreachExecution(context => futures.push(child.process(context)));
        await Promise.all(futures);
    }
    static getBuiltinSymbols() {
        return Parser.getBuiltInsSymbols();
    }
}
Interpreter.__gen = 0;
export class ExecutionContext {
    constructor(currBranch, state) {
        this.__currBranch = currBranch;
        this.__state = state;
    }
    get stream() { return this.leafNode.stream; }
    get leafNode() { return this.__currBranch[this.__currBranch.length - 1]; }
    updateStream(stream) {
        var stack = this.leafNode;
        stack.stream = stream;
    }
    saveVar(name, value) {
        this.leafNode.set(name, value);
    }
    get(name) {
        for (let idx = this.__currBranch.length - 1; idx >= 0; idx--) {
            const obj = this.__currBranch[idx].get(name);
            if (obj != null)
                return obj;
        }
        return null;
    }
}
export class InterpreterState {
    constructor(stream) {
        this.__scopes = [null];
        this.line = -1;
        this.__root = new StackBranch(Stream.mkText(stream), 0);
    }
    get depth() { return this.__scopes.length; }
    foreachExecution(action, depth) {
        this.foreachChain((c) => action(new ExecutionContext(c, this)));
    }
    foreachChain(action, depth) {
        this.chainIterHelper(action, this.__root, [this.__root], depth ?? (this.depth - 1));
    }
    chainIterHelper(action, node, chain, depth) {
        if (depth == 0) {
            action(chain, node);
        }
        else {
            for (const branch of node.__branches) {
                this.chainIterHelper(action, branch, chain.slice().concat(branch), depth - 1);
            }
        }
    }
    pushStack(state) {
        if (!(state instanceof ICanHaveScope))
            throw 'inner scope is unexpected';
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const streams = state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        });
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    popStack() {
        let owner = this.__scopes.pop();
        // since we popped, the leafs have branches
        this.foreachChain((chain, leaf) => {
            const context = new ExecutionContext(chain, this);
            const branches = leaf.branches.map(b => b.stream);
            let result = owner.onCloseChildScope(context, branches);
            context.updateStream(result);
            leaf.branches = null;
        });
    }
    exportAsStream() {
        if (this.depth == 1)
            return this.__root.stream;
        let streams = [];
        this.foreachChain((c, l) => streams.push(l.stream));
        if (streams.length == 1)
            return streams[0];
        return Stream.mkArr(streams);
    }
    setGlobalVal(name, value) {
        this.__root.set(name, value);
    }
}
class StackBranch {
    constructor(stream, index) {
        this.variables = {};
        this.__stream = stream;
        this.index = index;
    }
    get(name) {
        return this.variables[name];
    }
    set(name, value) {
        this.variables[name] = value;
    }
    get stream() { return this.__stream; }
    set stream(stream) { this.__stream = stream; }
    set branches(leafs) { this.__branches = leafs; }
    get branches() { return this.__branches; }
    addBranch(leaf) {
        if (this.__branches == null)
            this.__branches = [];
        this.__branches.push(leaf);
    }
}
//# sourceMappingURL=interpreter.js.map