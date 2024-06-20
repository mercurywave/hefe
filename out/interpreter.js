import { ICanHaveScope, Parser, SExit, SNoop } from "./parser.js";
import { Stream } from "./stream.js";
export class Interpreter {
    static async Process(input, code, debugLine) {
        let state = new InterpreterState(input.text, code);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        for (const key in input.variables) {
            state.setGlobalVal(key, Stream.mkText(input.variables[key]));
        }
        this.__gen++;
        let currGen = this.__gen;
        while (state.line < state.__code.length) {
            try {
                let canGo = await Interpreter.RunOneLine(state);
                if (state.line == debugLine)
                    canGo = false;
                if (!canGo) {
                    return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.line, isComplete: true };
                }
            }
            catch (err) {
                return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.line, isComplete: false, error: err };
            }
            if (currGen != this.__gen)
                return null;
            state.line++;
        }
        while (state.depth > 1)
            await state.popStack();
        return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.line, isComplete: true };
    }
    static async RunOneLine(state) {
        let step = state.__code[state.line];
        if (step instanceof SNoop)
            return true;
        if (step == null)
            throw "could not parse line: " + state.line;
        if (step.tabDepth + 1 > state.depth && state.lastStatement)
            await state.pushStack(state.lastStatement);
        while (state.depth > step.tabDepth + 1)
            await state.popStack();
        if (step instanceof SExit)
            return false;
        await Interpreter.parallelProcess(state, step);
        state.lastStatement = step;
        await new Promise(f => setTimeout(f, 1));
        return true;
    }
    static async ProcessInnerScope(state, stream) {
        let curDepth = state.currStatement.tabDepth;
        while (state.line < state.__code.length) {
            if (state.nextStatement?.tabDepth <= curDepth) {
                return true;
            }
            state.line++;
            if (!await this.RunOneLine(state)) {
                return false;
            }
        }
    }
    static async parallelProcess(state, child) {
        let futures = [];
        state.foreachExecution(context => {
            futures.push(child.process(context));
        });
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
    set scratch(value) { this.leafNode.__scratch = value; }
    get scratch() { return this.leafNode.__scratch; }
}
export class InterpreterState {
    get currStatement() { return this.__code[this.line]; }
    get nextStatement() { return this.__code[this.line + 1]; }
    constructor(stream, code) {
        this.__code = [];
        this.__scopes = [null];
        this.line = 0;
        this.lastStatement = null; // last actually evaluated statement - ignores nulls
        this.__root = new StackBranch(Stream.mkText(stream), 0);
        this.__code = code;
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
    getCurrChains() {
        let list = [];
        this.foreachChain((c, l) => list.push([c, l]));
        return list;
    }
    async pushStack(state) {
        if (!(state instanceof ICanHaveScope))
            throw 'inner scope is unexpected';
        let list = this.getCurrChains();
        for (const [chain, leaf] of list) {
            const context = new ExecutionContext(chain, this);
            const streams = await state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        }
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    async popStack() {
        let owner = this.__scopes.pop();
        // since we popped, the leafs have branches
        let list = this.getCurrChains();
        for (const [chain, leaf] of list) {
            const context = new ExecutionContext(chain, this);
            const branches = leaf.branches.map(b => b.stream);
            let result = await owner.onCloseChildScope(context, branches);
            context.updateStream(result);
            leaf.branches = null;
        }
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
    exportVariables() {
        let baseVars = { ...this.__root.variables };
        let vars = {};
        this.foreachChain((c, l) => {
            for (const v of Object.keys(l.variables)) {
                if (!vars[v])
                    vars[v] = [];
                vars[v].push(l.variables[v]);
            }
        });
        for (const v of Object.keys(vars)) {
            if (!baseVars[v])
                baseVars[v] = Stream.mkArr(vars[v]);
        }
        return baseVars;
    }
    setGlobalVal(name, value) {
        this.__root.set(name, value);
    }
}
class StackBranch {
    constructor(stream, index) {
        this.__scratch = null;
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