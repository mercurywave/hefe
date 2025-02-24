import { Autocomplete } from "./code-input/auto-complete.js";
import { CodeInput, Template } from "./code-input/code-input.js";
import { eCommandType } from "./command.js";
import { Interpreter, LineError } from "./interpreter.js";
import { eTokenType, Lexer } from "./Lexer.js";
import { Parser } from "./parser.js";
import "./stdlib.js";
const STREAM = "stream";
const INPUT = "Input";
export class Workspace {
    constructor() {
        this.DebugLine = 99999999;
        this.ErrorLine = 99999999;
        this._loadedScripts = [];
        this._scriptTabs = {};
        this._processOnVisible = false;
        this._inputTabValues = {};
        this._outputTabs = {};
        this._lblFile = document.querySelector("#lblFile");
        this._ctlCommand = document.querySelector("#cmdMain");
        this._ctlSidebar = document.querySelector("#sidebar");
        this._btCopy = document.querySelector("#btCopyToClip");
        this._btCopy.addEventListener("click", () => this._txtOutput.copyToClipboard());
        let btHelp = document.querySelector("#btHelp");
        btHelp.addEventListener("click", () => { setTimeout(() => this._ctlCommand.show(), 0); });
        this._ctlCommand.addEventListener("onHide", () => { setTimeout(() => this._txtEditor.rawTextArea.focus(), 0); });
        this._txtInput = document.querySelector("#txtInput");
        this.setupTextArea(this._txtInput, true);
        this._tbInput = document.querySelector("#tbInput");
        let btNewIn = this._tbInput.addFixedTab("+");
        this._tbInput.addEventListener("tabSelected", (e) => this.switchInputs(e.detail.key));
        this._mainInputTab = this.generateNewInput(true);
        btNewIn.addEventListener("tabclick", () => this.generateNewInput(false));
        this._txtOutput = document.querySelector("#txtOutput");
        this._tbOutput = document.querySelector("#tbOutput");
        let tabStream = this._tbOutput.addTab("Output", STREAM);
        this._outputTabs[STREAM] = tabStream;
        this._tbOutput.selectTab(tabStream); // select before the event listener is attached
        this._tbOutput.addEventListener("tabSelected", (e) => this.switchOutputs(e.detail.key));
        this._lblError = document.querySelector("#lblError");
        this._txtEditor = document.querySelector("#txtSource");
        this.setupEditor(this._txtEditor);
        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.setupCommands();
            this.process();
        }, 0);
        this._tbEditor = document.querySelector("#tbSource");
        this._tbEditor.addEventListener("tabSelected", (ev) => this.onSwitchToTab(ev.detail.tab));
        var btAddScript = this._tbEditor.addFixedTab("+");
        btAddScript.addEventListener("tabclick", () => this.generateNewScript());
        this.loadTabs();
        window.addEventListener("storage", e => this.resyncTabs());
        document.addEventListener("visibilitychange", e => {
            if (!document.hidden && this._processOnVisible) {
                this._processOnVisible = false;
                this.process();
            }
        });
    }
    setupCommands() {
        for (const help of _loadedHelpPages) {
            let type = eCommandType.concept;
            if (help.type === "functions")
                type = eCommandType.function;
            if (help.type === "concepts")
                type = eCommandType.concept;
            if (help.type === "how to")
                type = eCommandType.howTo;
            let search = help.title + "\n" + help.content;
            let content = `
                <h1>${help.title}</h1>
                <div>${help.content}</div>
            `;
            this._ctlCommand.registerCommand(help.title, type, i => this._ctlSidebar.show(content), search);
        }
        this._ctlCommand.indexCommands();
    }
    setupEditor(area) {
        area.addEventListener("input", () => this.queueProcess());
        area.addEventListener("keydown", e => {
            if (e.key == 'Tab') {
                e.preventDefault();
                var start = area.selectionStart;
                var end = area.selectionEnd;
                var possibleAdds = HefeHighlighter.GetSuggestions(area.rawTextArea, end);
                if (possibleAdds.toInsert) {
                    let symbol = possibleAdds.toInsert.symbol;
                    area.value = area.value.substring(0, possibleAdds.atStart)
                        + symbol
                        + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = possibleAdds.atStart + symbol.length;
                }
                else {
                    area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start + 1;
                }
                this.queueProcess();
            }
            if (e.key == "Enter") {
                if (e.ctrlKey) {
                    let pos = area.selectionEnd;
                    let lines = area.value.split("\n");
                    let curY = 0;
                    for (curY = 0; curY < lines.length; curY++) {
                        let ln = lines[curY].length;
                        if (pos <= ln)
                            break;
                        pos -= (ln + 1);
                    }
                    if (this.DebugLine == curY)
                        curY = 99999999;
                    this.DebugLine = curY;
                    area.update(area.value);
                    this.process();
                    e.preventDefault();
                }
            }
        });
        area.addEventListener("dragover", () => area.classList.add("dropping"), false);
        area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", event => this.onFileDropped(event, area));
    }
    setupTextArea(area, hookEvents) {
        if (hookEvents) {
            area.addEventListener("input", () => this.queueProcess());
            area.addEventListener("dragover", () => area.classList.add("dropping"), false);
            area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", event => this.onFileDropped(event, area));
        }
        area.addEventListener("keydown", e => {
            if (e.key == 'Tab') {
                e.preventDefault();
                var start = area.selectionStart;
                var end = area.selectionEnd;
                area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start + 1;
                this.queueProcess();
            }
        });
    }
    loadTabs() {
        let array = [];
        for (const key of this.getScriptKeys()) {
            array.push(new Script(key));
        }
        if (array.length == 0) {
            array.push(new Script());
        }
        array.sort((a, b) => b.LastEdit.getTime() - a.LastEdit.getTime());
        for (let script of array) {
            this.makeTab(script);
        }
        this.switchToTab(array[0]);
    }
    getScriptKeys() {
        let array = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key.startsWith("hefe")) {
                array.push(key);
            }
        }
        return array;
    }
    resyncTabs() {
        console.log("Updating from local storage");
        for (const key of this.getScriptKeys()) {
            if (this._scriptTabs[key] == null) {
                this.makeTab(new Script(key));
            }
            let tab = this._scriptTabs[key];
            let script = this._loadedScripts.find(s => s.Key == key);
            script.Save;
            if (!tab || !script)
                continue;
            if (!script.Reload())
                continue;
            tab.name = script.Name;
            if (this._tbEditor.selectedTab === tab) {
                this._txtEditor.value = script.Code ?? "";
                if (document.hidden)
                    this._processOnVisible = true;
                else
                    this.process();
            }
        }
    }
    makeTab(script, inFront) {
        let tab = this._tbEditor.addTab(script.Name, script.Key, inFront);
        this._loadedScripts.push(script);
        this._scriptTabs[script.Key] = tab;
        tab.renameHook = s => s.trim();
        tab.addEventListener("changeLabel", (ev) => {
            script.Name = ev.detail.value;
            this._txtEditor.rawTextArea.focus();
            script.Save();
        });
        return tab;
    }
    generateNewScript() {
        let script = new Script();
        let id = this._loadedScripts.filter(s => s.Name.startsWith("temp ")).length + 1;
        script.Name = "temp " + id;
        this.makeTab(script, true);
        script.Save();
        this.switchToTab(script);
    }
    switchToTab(script) {
        this._tbEditor.selectTab(this._scriptTabs[script.Key]);
    }
    onSwitchToTab(tab) {
        let script = this._loadedScripts.find(s => s.Key == tab.key);
        this._selectedScript = script;
        if (!script)
            return;
        this._txtEditor.value = script.Code ?? "split";
        this.process();
    }
    switchInputs(key) {
        if (this._selectedInput == key)
            return;
        if (this._selectedInput) {
            this._inputTabValues[this._selectedInput].value = this._txtInput.value;
        }
        this._selectedInput = key;
        this._txtInput.value = this._inputTabValues[key].value;
    }
    generateNewInput(isMainInput) {
        let name = "";
        if (isMainInput) {
            name = INPUT;
        }
        else {
            for (let index = 1; index < 999; index++) {
                name = "in" + index;
                if (!Object.values(this._inputTabValues).find(t => t.tab.name == name))
                    break;
            }
        }
        let key = "k" + Date.now();
        let tab = this._tbInput.addTab(name, key);
        if (!isMainInput)
            tab.renameHook = s => s.replaceAll(' ', '');
        this._inputTabValues[key] = { value: "", tab: tab };
        this._tbInput.selectTab(tab);
        if (!isMainInput)
            this.process();
        return tab;
    }
    getVariableValue(name) {
        var active = this._inputTabValues[this._selectedInput];
        if (active.tab.name == name)
            return this._txtInput.value;
        for (const tab of Object.values(this._inputTabValues)) {
            if (tab.tab.name == name)
                return tab.value;
        }
        return "";
    }
    onFileDropped(ev, target) {
        if (ev.dataTransfer.items) {
            for (const item of ev.dataTransfer.items) {
                if (item.kind === 'file') {
                    ev.preventDefault();
                    this.readFile(item.getAsFile(), target);
                }
            }
        }
    }
    readFile(file, target) {
        console.log(file);
        let reader = new FileReader();
        reader.onload = ev => {
            target.value = reader.result.toString();
            if (this._inputTabValues[this._selectedInput].tab == this._mainInputTab) {
                this._fileName = file.name;
                this._lblFile.textContent = "Hefe - " + file.name;
            }
            this.process();
        };
        reader.readAsText(file);
    }
    queueProcess() {
        setTimeout(() => this.process(), 250);
    }
    process() {
        //const a = new Parser();
        try {
            const code = this._txtEditor.value;
            if (this._selectedScript != null && this._selectedScript.Code != code) {
                this._selectedScript.Code = code;
                this._selectedScript.Save();
            }
            this.asyncProcess(code, this.DebugLine);
        }
        catch (err) {
            this.ShowError(err);
        }
    }
    async asyncProcess(code, debugLine) {
        try {
            var parse = Parser.Parse(code);
            HefeHighlighter.CustomSymbols = Array.from(parse.identifiers).map(s => { return { symbol: s, display: s }; });
            for (const func of Object.values(parse.functionDefs)) {
                HefeHighlighter.CustomSymbols.push({ symbol: func.name + "(", display: func.displayDef });
            }
            let inVars = {};
            for (const tab of Object.values(this._inputTabValues)) {
                var name = tab.tab.name;
                if (tab.tab !== this._mainInputTab && name != "")
                    inVars[name] = this.getVariableValue(name);
            }
            const input = {
                text: this.getVariableValue(INPUT),
                fileName: this._fileName ?? "[temp file]",
                variables: inVars,
            };
            let res = await Interpreter.Process(input, parse, debugLine);
            if (res != null) {
                let outVars = Object.keys(res.variables);
                outVars = outVars.filter(v => v != "fileName" && inVars[v] == null); // not useful
                outVars.push(STREAM);
                for (const v of outVars) {
                    if (this._outputTabs[v] == null) {
                        this._outputTabs[v] = this._tbOutput.addTab(v, v);
                    }
                }
                for (const v of Object.keys(this._outputTabs)) {
                    if (!outVars.find(k => k == v)) {
                        this._tbOutput.removeTab(this._outputTabs[v]);
                        delete this._outputTabs[v];
                    }
                }
                if (!this._outputTabs[this._selectedOutput]) {
                    this._selectedOutput = STREAM;
                    this._tbOutput.selectTab(this._outputTabs[STREAM]);
                }
                if (this._selectedOutput == STREAM) {
                    this._txtOutput.stream = res.output;
                }
                else {
                    this._txtOutput.stream = res.variables[this._selectedOutput];
                }
                if (res?.error)
                    this.ShowError(res.error);
                else {
                    this._lblError.textContent = "";
                    this.ErrorLine = 99999999;
                }
                this._txtEditor.refresh();
            }
        }
        catch (err) {
            this.ShowError(err);
        }
    }
    switchOutputs(key) {
        if (this._selectedOutput == key)
            return;
        this._selectedOutput = key;
        this.process();
    }
    ShowError(err) {
        if (err instanceof LineError) {
            this.ErrorLine = err.Line;
            this._txtEditor.refresh();
        }
        console.log("error:", err);
        this._lblError.textContent = err.message;
    }
}
class Script {
    constructor(key) {
        if (key == null) {
            let iter = Date.now();
            while (localStorage.getItem("hefe" + iter) != null) {
                iter++;
            }
            this.Key = "hefe" + iter;
            this.Name = (new Date()).toDateString();
            this.Code = "";
            this.LastEdit = new Date();
        }
        else {
            this.Key = key;
            this.Reload();
        }
    }
    Save() {
        if (this.Code == "") {
            localStorage.removeItem(this.Key);
            return;
        }
        const obj = {
            name: this.Name,
            edit: JSON.stringify(new Date()),
            code: this.Code
        };
        localStorage.setItem(this.Key, JSON.stringify(obj));
    }
    Reload() {
        const obj = JSON.parse(localStorage.getItem(this.Key));
        if (JSON.stringify(this.LastEdit) === obj.edit)
            return false;
        this.Name = obj.name;
        this.LastEdit = new Date(JSON.parse(obj.edit));
        this.Code = obj.code;
        if (this.Name == "")
            this.Name = (new Date()).toDateString();
        return true;
    }
}
class HefeHighlighter extends Template {
    constructor(workSpace) {
        super(true, true, true, [new Autocomplete(HefeHighlighter.updatePopup)]);
        this._workspace = workSpace;
        HefeHighlighter.BuiltInSymbols = Interpreter.getBuiltinSymbols();
    }
    highlight(resultElement, ctl) {
        let htmlResult = [];
        let lines = ctl.value.split("\n");
        let baseSymbols = new Set(HefeHighlighter.BuiltInSymbols.map(c => c.symbol));
        for (let i = 0; i < lines.length; i++) {
            if (i > 0)
                htmlResult.push("</br>");
            let code = lines[i];
            if (i == this._workspace.DebugLine) {
                htmlResult.push(`<span style="color:#F1D815">${ctl.escape_html(code + "  <<DEBUG>>")}</span>`);
                continue;
            }
            if (i == this._workspace.ErrorLine) {
                htmlResult.push(`<span style="color:#BF4938">${ctl.escape_html(code + "  <<ERROR>>")}</span>`);
                continue;
            }
            try {
                let lex = Lexer.Tokenize(code);
                for (let pos = 0; pos < code.length; pos++) {
                    const symb = code[pos];
                    const toke = Lexer.getTokenAt(lex.details, pos);
                    const type = toke?.type;
                    const color = HefeHighlighter.getColor(type);
                    htmlResult.push(`<span style="color: ${color}">${ctl.escape_html(symb)}</span>`);
                }
            }
            catch {
                htmlResult.push(`<span style="color:#BF4938">${ctl.escape_html(code)}</span>`);
            }
        }
        // extra space makes sure the pre height matches the inner text area
        htmlResult.push(`<span style="color:#BF4938">&nbsp;</span>`);
        resultElement.innerHTML = htmlResult.join("");
    }
    static getColor(type) {
        switch (type) {
            case eTokenType.comment: return "#57A64A";
            case eTokenType.identifier: return "#DCDCDC";
            case eTokenType.literalNumber: return "#B5CEA8";
            case eTokenType.literalString: return "#D69D85";
            case eTokenType.symbol: return "#DCDCDC";
            default: return "";
        }
    }
    static updatePopup(popupElem, textarea, selectionEnd) {
        const toShow = HefeHighlighter.GetSuggestions(textarea, selectionEnd).possible;
        let elems = [];
        for (const suggest of toShow) {
            elems.push(`<div class=suggest>${suggest.display}</div>`);
        }
        popupElem.innerHTML = elems.join("");
    }
    static GetSuggestions(textarea, selectionEnd) {
        if (selectionEnd != textarea.selectionStart)
            return { possible: [] };
        let lines = textarea.value.split("\n");
        let code = "";
        for (const line of lines) {
            if (selectionEnd <= line.length) {
                code = line;
                break;
            }
            selectionEnd -= line.length + 1;
        }
        try {
            let lex = Lexer.Tokenize(code);
            let details = Lexer.getTokenAt(lex.details, selectionEnd - 1);
            if (details?.type == eTokenType.identifier) {
                if (selectionEnd == details.start + details.token.length) {
                    let curr = details.token;
                    if (HefeHighlighter.BuiltInSymbols.find(s => s.symbol == curr))
                        return { possible: [] };
                    let arr = HefeHighlighter.BuiltInSymbols.concat(HefeHighlighter.CustomSymbols);
                    let scored = arr
                        .map(s => { return { match: s, score: HefeHighlighter.match(curr, s.symbol) }; })
                        .filter(s => s.score >= 10)
                        .sort((a, b) => b.score - a.score); // lower idx better
                    if (scored.length == 0)
                        return { possible: [] };
                    const possible = scored.map(s => s.match);
                    return {
                        possible,
                        toInsert: possible[0],
                        atStart: textarea.selectionEnd - curr.length
                    };
                }
            }
        }
        catch { }
        return { possible: [] };
    }
    static match(token, possible) {
        if (token === possible)
            return 0;
        let exact = 0;
        for (let i = 0; i < token.length && i < possible.length; i++) {
            if (token[i] != possible[i])
                break;
            exact++;
        }
        let remTok = token.slice(exact);
        let remPoss = possible.slice(exact);
        let close = 0;
        for (let i = 0; i < remTok.length; i++) {
            let sym = remTok[i];
            if (remPoss.includes(sym)) {
                close += 1 + (sym == sym.toUpperCase() ? 3 : 0);
            }
        }
        return exact * 10 + close;
    }
}
HefeHighlighter.CustomSymbols = [];
let _loadedHelpPages = [];
export function regHelp(pages) {
    _loadedHelpPages.push(...pages);
}
let _instance;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace();
    const _highlighter = new HefeHighlighter(_instance);
    CodeInput.registerTemplate("def", _highlighter);
});
//# sourceMappingURL=main.js.map