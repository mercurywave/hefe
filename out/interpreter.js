import { ICanHaveScope, Parser, SExit, SNoop } from "./parser.js";
import { Stream } from "./stream.js";
export class Interpreter {
    static async Process(input, parse, debugLine) {
        let state = new InterpreterState(Stream.mkText(input.text), parse.Statements, parse.functionDefs, debugLine, input);
        state.setGlobalVal("fileName", Stream.mkText(input.fileName));
        for (const key in input.variables) {
            state.setGlobalVal(key, Stream.mkText(input.variables[key]));
        }
        this.__gen++;
        let currGen = this.__gen;
        while (state.statementLine < state.__code.length) {
            if (state.currFileLine > state.__debugLine) {
                return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.statementLine, isComplete: true };
            }
            try {
                let canGo = await Interpreter.RunOneLine(state);
                if (!canGo) {
                    return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.statementLine, isComplete: true };
                }
            }
            catch (err) {
                return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.statementLine, isComplete: false, error: new LineError(err, state.currFileLine) };
            }
            if (currGen != this.__gen)
                return null;
            state.statementLine++;
        }
        await state.wrapUp();
        return { output: state.exportAsStream(), variables: state.exportVariables(), step: state.statementLine, isComplete: true };
    }
    static async RunOneLine(state) {
        let step = state.__code[state.statementLine];
        if (step instanceof SNoop)
            return true;
        if (step == null)
            throw "could not parse line: " + state.statementLine;
        if (step.scopeDepth + 1 > state.depth && state.lastStatement)
            await state.pushStack(state.lastStatement);
        else if (state.expectingInnerScope)
            await state.checkAutoCloseStack(state.lastStatement);
        while (state.depth > step.scopeDepth + 1)
            await state.popStack();
        if (step instanceof ICanHaveScope)
            state.expectingInnerScope = true;
        if (step instanceof SExit)
            return false;
        await Interpreter.parallelProcess(state, step);
        state.lastStatement = step;
        await new Promise(f => setTimeout(f, 1));
        return true;
    }
    static async ProcessInnerScope(state, stream) {
        let curDepth = state.currStatement.scopeDepth;
        while (state.statementLine < state.__code.length) {
            if (state.nextStatement?.scopeDepth <= curDepth) {
                return true;
            }
            state.statementLine++;
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
    static async RunUserFunction(context, func, params, stream) {
        let interpreter = context.__state;
        let state = new InterpreterState(stream, func.code, interpreter.functionDefs, interpreter.__debugLine, interpreter.__inputContext);
        for (let index = 0; index < params.length; index++) {
            state.setGlobalVal(func.params[index], params[index]);
        }
        let currGen = this.__gen;
        // don't want to halt because of a breakpoint above the function
        let debugLine = state.__debugLine;
        if (debugLine < state.statementLine)
            debugLine = 99999999;
        while (state.statementLine < state.__code.length) {
            try {
                if (state.currFileLine > debugLine) {
                    return state.exportAsStream();
                }
                let canGo = await Interpreter.RunOneLine(state);
                if (!canGo) {
                    return state.exportAsStream();
                }
            }
            catch (err) {
                console.log(err);
                throw new Error(`error in function ${func.name}: ${err.message}`);
            }
            if (currGen != this.__gen)
                return null;
            state.statementLine++;
        }
        await state.wrapUp();
        return state.exportAsStream();
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
    get selectedFolder() { return this.__state.selectedFolder; }
    get originalInput() { return this.__state.__inputContext; }
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
    get currStatement() { return this.__code[this.statementLine]; }
    get nextStatement() { return this.__code[this.statementLine + 1]; }
    get currFileLine() { return this.currStatement.fileLine; }
    get selectedFolder() { return this.__inputContext.folder; }
    constructor(stream, code, funcs, debugLine, input) {
        this.__code = [];
        this.__scopes = [null];
        this.statementLine = 0;
        this.lastStatement = null; // last actually evaluated statement - ignores nulls
        this.expectingInnerScope = false;
        this.__root = new StackBranch(stream, 0);
        this.__code = code;
        this.functionDefs = funcs;
        this.__debugLine = debugLine;
        this.__inputContext = input;
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
        this.expectingInnerScope = false;
        let list = this.getCurrChains();
        for (const [chain, leaf] of list) {
            const context = new ExecutionContext(chain, this);
            const streams = await state.onOpenChildScope(context);
            leaf.branches = streams.map((s, i) => new StackBranch(s, i));
        }
        this.__scopes.push(state); // run after because this affects depth calculation
    }
    async popStack() {
        this.expectingInnerScope = false;
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
    async checkAutoCloseStack(laststate) {
        if (!(laststate instanceof ICanHaveScope))
            return;
        await this.pushStack(laststate);
        await this.popStack();
    }
    async wrapUp() {
        if (this.expectingInnerScope)
            await this.checkAutoCloseStack(this.lastStatement);
        while (this.depth > 1)
            await this.popStack();
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
export class LineError extends Error {
    constructor(msg, line) {
        super(msg);
        this.Line = line;
    }
}
//# sourceMappingURL=interpreter.js.map