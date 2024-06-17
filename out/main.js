import { Autocomplete } from "./code-input/autocomplete.js";
import { CodeInput, Template } from "./code-input/code-input.js";
import { Interpreter } from "./interpreter.js";
import { eTokenType, Lexer } from "./Lexer.js";
import { Parser } from "./parser.js";
import "./stdlib.js";
export class Workspace {
    constructor() {
        this._loadedScripts = [];
        this._scriptTabs = {};
        this._lblFile = document.querySelector("#lblFile");
        this._btCopy = document.querySelector("#btCopyToClip");
        this._btCopy.addEventListener("click", () => this.copyToClipboard(this._txtOutput));
        this._txtInput = document.querySelector("#txtInput");
        this.setupTextArea(this._txtInput, true);
        this._txtOutput = document.querySelector("#txtOutput");
        this.setupTextArea(this._txtOutput, false);
        this._lblError = document.querySelector("#lblError");
        this._txtEditor = document.querySelector("#txtSource");
        this.setupEditor(this._txtEditor);
        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.process();
        }, 0);
        this._tbEditor = document.querySelector("#tbSource");
        this._tbEditor.addEventListener("tabSelected", (ev) => this.onSwitchToTab(ev.detail.tab));
        var btAddScript = this._tbEditor.addFixedTab("+");
        btAddScript.addEventListener("click", () => this.generateNewScript());
        this.loadTabs();
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
                    area.value = area.value.substring(0, possibleAdds.atStart)
                        + possibleAdds.toInsert
                        + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = possibleAdds.atStart + possibleAdds.toInsert.length;
                }
                else {
                    area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start + 1;
                }
                this.queueProcess();
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
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            if (key.startsWith("hefe")) {
                array.push(new Script(key));
            }
        }
        if (array.length == 0) {
            array.push(new Script());
        }
        array.sort((a, b) => b.LastEdit.getTime() - a.LastEdit.getTime());
        for (let script of array) {
            let tab = this.makeTab(script);
        }
        this.switchToTab(array[0]);
    }
    makeTab(script, inFront) {
        let tab = this._tbEditor.addTab(script.Name, script.Key, inFront);
        this._loadedScripts.push(script);
        this._scriptTabs[script.Key] = tab;
        tab.renamable = true;
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
            this._fileName = file.name;
            this._lblFile.textContent = "Hefe - " + file.name;
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
            this.asyncProcess(code);
        }
        catch (err) {
            this.ShowError(err);
        }
    }
    async asyncProcess(code) {
        try {
            var parse = Parser.Parse(code);
            //console.log(parse);
            const input = {
                text: this._txtInput.value,
                fileName: this._fileName ?? "[temp file]",
            };
            let res = await Interpreter.Process(input, parse);
            if (res?.error)
                this.ShowError(res.error);
            else if (res != null) {
                this._txtOutput.value = res.output.toDisplayText();
                this._lblError.textContent = "";
            }
        }
        catch (err) {
            this.ShowError(err);
        }
    }
    copyToClipboard(textarea) {
        textarea.select();
        textarea.setSelectionRange(0, 9999999999);
        navigator.clipboard.writeText(textarea.value);
        console.log("copied to clipboard");
    }
    ShowError(err) {
        console.log("error:", err);
        this._lblError.textContent = err;
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
            this.Name = "???";
            this.Code = "";
            this.LastEdit = new Date();
        }
        else {
            this.Key = key;
            const obj = JSON.parse(localStorage.getItem(key));
            this.Name = obj.name;
            this.LastEdit = new Date(JSON.parse(obj.edit));
            this.Code = obj.code;
            if (this.Name == "")
                this.Name = (new Date()).toDateString();
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
}
class HefeHighlighter extends Template {
    constructor() {
        super(true, true, true, [new Autocomplete(HefeHighlighter.updatePopup)]);
        HefeHighlighter.BuiltInSymbols = Interpreter.getBuiltinSymbols();
    }
    highlight(resultElement, ctl) {
        let htmlResult = [];
        let lines = ctl.value.split("\n");
        let baseSymbols = new Set(HefeHighlighter.BuiltInSymbols);
        let foundSymbols = new Set();
        for (let i = 0; i < lines.length; i++) {
            if (i > 0)
                htmlResult.push("</br>");
            let code = lines[i];
            try {
                let lex = Lexer.Tokenize(code);
                for (const toke of lex.details) {
                    if (toke.type == eTokenType.identifier && !baseSymbols.has(toke.token))
                        foundSymbols.add(toke.token);
                }
                for (let pos = 0; pos < code.length; pos++) {
                    const symb = code[pos];
                    const type = Lexer.getTokenAt(lex.details, pos)?.type;
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
        HefeHighlighter.CustomSymbols = Array.from(foundSymbols);
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
            elems.push(`<div class=suggest>${suggest}</div>`);
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
                    if (HefeHighlighter.BuiltInSymbols.includes(curr))
                        return { possible: [] };
                    let arr = HefeHighlighter.BuiltInSymbols.concat(HefeHighlighter.CustomSymbols);
                    let scored = arr
                        .map(s => { return { sym: s, score: HefeHighlighter.match(curr, s) }; })
                        .filter(s => s.score >= 10)
                        .sort((a, b) => b.score - a.score); // lower idx better
                    if (scored.length == 0)
                        return { possible: [] };
                    const possible = scored.map(s => s.sym);
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
CodeInput.registerTemplate("def", new HefeHighlighter());
let _instance;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace();
});
//# sourceMappingURL=main.js.map