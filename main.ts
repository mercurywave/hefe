import { Autocomplete } from "./code-input/autocomplete.js";
import { CodeInput, Template } from "./code-input/code-input.js";
import { Interpreter } from "./interpreter.js";
import { eTokenType, Lexer } from "./Lexer.js";
import { Parser } from "./parser.js";
import "./stdlib.js";

export class Workspace {
    
    private _paneMain : HTMLElement;
    private _paneToolbar : HTMLElement;
    private _paneBottom : HTMLElement;
    private _btAddTab : HTMLElement;
    private _paneTabs : HTMLElement;
    private _lblFile : HTMLHeadingElement;
    private _lblError : HTMLHeadingElement;
    private _btCopy : HTMLInputElement;
    private _txtInput : HTMLTextAreaElement;
    private _txtOutput : HTMLTextAreaElement;
    private _txtEditor : CodeInput;

    private _fileName: string;

    private _selectedScript: Script;
    private _loadedScripts: Script[] = [];
    private _scriptTabs: Record<string, HTMLElement> = {};

    public constructor(pane: HTMLElement)
    {
        this._paneMain = pane;
        this._lblFile = pane.appendChild(document.createElement("h1"));
        this._lblFile.textContent = "Hefe - brew up a transform";
        
        this._paneToolbar = pane.appendChild(document.createElement("div"));
        this._paneToolbar.className = "toolbar";

        this._btCopy = this._paneToolbar.appendChild(document.createElement("input"));
        this._btCopy.type = "button";
        this._btCopy.value = "Copy to Clipboard";
        this._btCopy.addEventListener("click", () => this.copyToClipboard(this._txtOutput));

        this._txtInput = pane.appendChild(this.makeTextArea("txtIn", true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut", false));
        this._lblError = pane.appendChild(document.createElement("div"))
        this._lblError.className = "lblError";
        this._txtEditor = this.makeEditor(pane);

        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.process();
        }, 0);

        this._paneBottom = pane.appendChild(document.createElement("div"));
        this._paneBottom.classList.add('bottomBar');
        this._paneBottom.addEventListener('wheel', e => this._paneBottom.scrollLeft += e.deltaY);
        this._btAddTab = this._paneBottom.appendChild(this.makeAddTab());
        this._paneTabs = this._paneBottom.appendChild(document.createElement("span"));
        this._paneTabs.classList.add('tabList');
        this.loadTabs();
    }

    private makeEditor(pane: HTMLElement): CodeInput{
        let area = document.createElement("code-input") as CodeInput;
        area.classList.add("ed");

        area.addEventListener("input", () => this.queueProcess());
        CodeInput.registerTemplate("def", new HefeHighlighter() );
        let wrapperIn = pane.appendChild(document.createElement("div"));
        wrapperIn.className = "txtEd"
        wrapperIn.appendChild(area);
        area.addEventListener("keydown", e => { // need to allow inserting tabs
            if(e.key == 'Tab') {
                e.preventDefault();
                var start = area.selectionStart;
                var end = area.selectionEnd;
                var possibleAdds = HefeHighlighter.GetSuggestions(area.rawTextArea, end);
                if(possibleAdds.toInsert){
                    area.value = area.value.substring(0, possibleAdds.atStart)
                        + possibleAdds.toInsert
                        + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = possibleAdds.atStart + possibleAdds.toInsert.length;
                }
                else{
                    area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start + 1;
                }
                this.queueProcess();
            }
        });
        area.addEventListener("dragover", () => area.classList.add("dropping"), false);
        area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", event => this.onFileDropped(event, area as any));
        return area;
    }

    private makeTextArea(className:string, hookEvents: boolean):HTMLTextAreaElement {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.classList.add(className, "txtPanel", "txt");
        if (hookEvents){
            area.addEventListener("input", () => this.queueProcess());
            area.addEventListener("dragover", () => area.classList.add("dropping"), false);
            area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", event => this.onFileDropped(event, area));
        }
        area.addEventListener("keydown", e => { // need to allow inserting tabs
            if(e.key == 'Tab') {
                e.preventDefault();
                var start = area.selectionStart;
                var end = area.selectionEnd;
                area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start + 1;
                this.queueProcess();
            }
        });
        return area;
    }

    private loadTabs(){
        let array : Script[] = [];
        for (let i = 0; i < localStorage.length; i++){
            let key = localStorage.key(i);
            if(key.startsWith("hefe")){
                array.push(new Script(key));
            }
        }
        if(array.length == 0) { array.push(new Script()); }
        array.sort((a,b) => b.LastEdit.getTime() - a.LastEdit.getTime());
        for(let script of array){
            const tab = this.makeTab(script);
            this._paneTabs.appendChild(tab);
        }
        this.switchToTab(array[0]);
    }
    private makeTab(script: Script): HTMLElement{
        this._loadedScripts.push(script);
        let tab = document.createElement("span");
        this._scriptTabs[script.Key] = tab;
        tab.classList.add('tab');
        let lbl = tab.appendChild(document.createElement("span"));
        lbl.classList.add("lbl");
        lbl.innerText = script.Name;
        let txtName = tab.appendChild(document.createElement("input"));
        txtName.type = 'text';
        txtName.value = script.Name;
        txtName.addEventListener('change', () => {
            var txt = txtName.value;
            script.Name = (txt == "") ? "???" : txt;
            lbl.innerText = script.Name;
            script.Save();
        });
        txtName.addEventListener('keyup', e => {
            if(e.key === 'Enter' || e.key == 'Escape') { this._txtEditor.rawTextArea.focus(); }
        });
        txtName.addEventListener('blur', () => {
            tab.classList.remove('editing');
        })
        tab.addEventListener('click', () => {
            if(script == this._selectedScript){
                tab.classList.toggle('editing');
                txtName.focus();
                txtName.select();
            }
            else {
                this.switchToTab(script);
            }
        });
        return tab;
    }
    private makeAddTab():HTMLElement{
        let bt = this._paneBottom.appendChild(document.createElement("span"));
        bt.classList.add('btAdd', 'tab');
        bt.innerText = "+";
        bt.addEventListener('click', () => this.generateNewScript());
        return bt;
    }
    private generateNewScript(){
        let script = new Script();
        let id = this._loadedScripts.filter(s=>s.Name.startsWith("temp ")).length + 1;
        script.Name = "temp " + id;
        let tab = this.makeTab(script);
        this._paneTabs.insertBefore(tab, this._paneTabs.firstChild);
        this.switchToTab(script);
    }
    private switchToTab(script: Script){
        var prev = this._selectedScript;
        if(prev != null){
            this._selectedScript = null; // set to null so we don't update timestamp
            this._scriptTabs[prev.Key].classList.remove('selected');
        }
        this._txtEditor.value = script.Code;
        this._selectedScript = script;
        this._scriptTabs[script.Key].classList.add('selected');
        this.process();
    }

    private onFileDropped(ev: DragEvent, target: HTMLTextAreaElement){
        if(ev.dataTransfer.items){
            for (const item of ev.dataTransfer.items) {
                if (item.kind === 'file') {
                    ev.preventDefault();
                    this.readFile(item.getAsFile(), target);
                }
            }
        }
    }

    private readFile(file: File, target: HTMLTextAreaElement){
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

    public queueProcess(){
        setTimeout(() => this.process(), 250);
    }

    public process(){
        //const a = new Parser();
        try{
            const code = this._txtEditor.value;
            if(this._selectedScript != null && this._selectedScript.Code != code){
                this._selectedScript.Code = code;
                this._selectedScript.Save();
            }
            
            this.asyncProcess(code);
        }
        catch(err){
            this.ShowError(err);
        }
    }
    public async asyncProcess(code: string){
        try{
            var parse = Parser.Parse(code);
            //console.log(parse);
            const input = {
                text: this._txtInput.value,
                fileName: this._fileName ?? "[temp file]",
            }
            let res = await Interpreter.Process(input, parse);
            if(res?.error)
                this.ShowError(res.error);
            else if(res != null)
            {
                this._txtOutput.value = res.output.toDisplayText();
                this._lblError.textContent = "";
            }
        } catch(err){this.ShowError(err);}
    }

    private copyToClipboard(textarea: HTMLTextAreaElement){
        textarea.select();
        textarea.setSelectionRange(0, 9999999999);

        navigator.clipboard.writeText(textarea.value);
        console.log("copied to clipboard");
    }

    private ShowError(err){
        console.log("error:", err);
        this._lblError.textContent = err;
    }
}

class Script {
    public Name: string;
    public LastEdit: Date;
    public Code: string;
    public Key: string
    public constructor(key?: string){
        if(key == null){
            let iter = Date.now();
            while(localStorage.getItem("hefe" + iter) != null){
                iter++;
            }
            this.Key = "hefe" + iter;
            this.Name = "???";
            this.Code = "";
            this.LastEdit = new Date();
        } else{
            this.Key = key;
            const obj = JSON.parse(localStorage.getItem(key)) as IScriptJson;
            this.Name = obj.name;
            this.LastEdit = new Date(JSON.parse(obj.edit));
            this.Code = obj.code;
            if(this.Name == "") this.Name = (new Date()).toDateString();
        }
    }
    public Save(){
        if(this.Code == ""){
            localStorage.removeItem(this.Key);
            return;
        }
        const obj : IScriptJson = {
            name: this.Name,
            edit: JSON.stringify(new Date()),
            code: this.Code
        }
        localStorage.setItem(this.Key, JSON.stringify(obj));
    }
}

interface IScriptJson {
    name: string;
    edit: string;
    code: string;
}

class HefeHighlighter extends Template{
    static CustomSymbols: string[] = [];
    static BuiltInSymbols: string[];
    public constructor()
    {
        super(true, true, true, [new Autocomplete(HefeHighlighter.updatePopup)]);
        HefeHighlighter.BuiltInSymbols = Interpreter.getBuiltinSymbols();
    }
    public highlight(resultElement: Element, ctl?: CodeInput): void {
        let htmlResult: string[] = [];
        let lines = ctl.value.split("\n");
        let baseSymbols = new Set<string>(HefeHighlighter.BuiltInSymbols);
        let foundSymbols = new Set<string>();
        for (let i = 0; i < lines.length; i++) {
            if(i > 0) htmlResult.push("</br>");
            let code = lines[i];
            try{
                let lex = Lexer.Tokenize(code);

                for (const toke of lex.details) {
                    if(toke.type == eTokenType.identifier && !baseSymbols.has(toke.token))
                        foundSymbols.add(toke.token);
                }

                for (let pos = 0; pos < code.length; pos++) {
                    const symb = code[pos];
                    const type = Lexer.getTokenAt(lex.details, pos)?.type;
                    const color = HefeHighlighter.getColor(type);
                    htmlResult.push(`<span style="color: ${color}">${ctl.escape_html(symb)}</span>`);
                }
            } catch{
                htmlResult.push(`<span style="color:#BF4938">${ctl.escape_html(code)}</span>`);
            }
        }
        // extra space makes sure the pre height matches the inner text area
        htmlResult.push(`<span style="color:#BF4938">&nbsp;</span>`); 
        HefeHighlighter.CustomSymbols = Array.from(foundSymbols);
        resultElement.innerHTML = htmlResult.join("");
    }
    static getColor(type: eTokenType): string{
        switch (type) {
            case eTokenType.comment: return "#57A64A";
            case eTokenType.identifier: return "#DCDCDC";
            case eTokenType.literalNumber: return "#B5CEA8";
            case eTokenType.literalString: return "#D69D85";
            case eTokenType.symbol: return "#DCDCDC";
            default: return "";
        }
    }
    static updatePopup(popupElem: HTMLElement, textarea: HTMLTextAreaElement, selectionEnd: number){
        const toShow = HefeHighlighter.GetSuggestions(textarea, selectionEnd).possible;
        
        let elems: string[] = [];
        for (const suggest of toShow) {
            elems.push(`<div class=suggest>${suggest}</div>`);
        }
        popupElem.innerHTML = elems.join("");
    }
    public static GetSuggestions(textarea: HTMLTextAreaElement, selectionEnd: number): CompMatchSuggestion{
        if(selectionEnd != textarea.selectionStart) return {possible: []};
        let lines = textarea.value.split("\n");
        let code = "";
        for (const line of lines) {
            if(selectionEnd <= line.length) {
                code = line;
                break;
            }
            selectionEnd -= line.length + 1;
        }
        try{
            let lex = Lexer.Tokenize(code);
            let details = Lexer.getTokenAt(lex.details, selectionEnd - 1);
            if(details?.type == eTokenType.identifier){
                if(selectionEnd == details.start + details.token.length){
                    let curr = details.token;
                    if(HefeHighlighter.BuiltInSymbols.includes(curr)) return {possible:[]};
                    let arr = HefeHighlighter.BuiltInSymbols.concat(HefeHighlighter.CustomSymbols);
                    let scored: CompMatchScore[] = arr
                        .map(s => {return {sym:s, score: HefeHighlighter.match(curr, s)}})
                        .filter(s => s.score >= 10)
                        .sort((a,b) => b.score - a.score); // lower idx better
                    if(scored.length == 0) return {possible:[]}
                    
                    const possible = scored.map(s => s.sym);
                    return {
                        possible,
                        toInsert: possible[0],
                        atStart: textarea.selectionEnd - curr.length
                    };
                }
            }
        }catch{}
        return  {possible:[]};
    }
    static match(token: string, possible: string): number{
        if(token === possible) return 0;
        let exact = 0;
        for (let i = 0; i < token.length && i < possible.length; i++) {
            if(token[i] != possible[i]) break;
            exact++;
        }
        let remTok = token.slice(exact);
        let remPoss = possible.slice(exact);
        let close = 0;
        for (let i = 0; i < remTok.length; i++) {
            let sym = remTok[i];
            if(remPoss.includes(sym))
            {
                close += 1 + (sym == sym.toUpperCase() ? 3 : 0);
            }
        }
        return exact * 10 + close;
    }
}

interface CompMatchScore{
    sym: string;
    score: number;
}

interface CompMatchSuggestion{
    possible: string[];
    toInsert?: string;
    atStart?: number;
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});