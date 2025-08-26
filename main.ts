import { Autocomplete } from "./code-input/auto-complete.js";
import { CodeInput, Template } from "./code-input/code-input.js";
import { CommandPalette, eCommandType } from "./command.js";
import { Interpreter, LineError, VirtualFolder } from "./interpreter.js";
import { eTokenType, Lexer } from "./Lexer.js";
import { StreamDisplay } from "./output.js";
import { Parser } from "./parser.js";
import { Sidebar } from "./sidebar.js";
import "./stdlib.js";
import { Stream } from "./stream.js";
import { TabStrip, Tab } from "./tabstrip.js";

const STREAM = "stream";
const INPUT = "Input";

export class Workspace {
    
    public DebugLine: number = 99999999;
    public ErrorLine: number = 99999999;
    
    private _lblError : HTMLHeadingElement;
    private _btCopy : HTMLInputElement;
    private _txtInput : HTMLTextAreaElement;
    private _tbInput : TabStrip;
    private _txtOutput : StreamDisplay;
    private _tbOutput : TabStrip;
    private _txtEditor : CodeInput;
    private _tbEditor : TabStrip;

    private _btFolder : HTMLButtonElement;
    private _btFiles : HTMLButtonElement;
    private _selectFolder : FileSystemDirectoryHandle;
    private _selectedFiles : FileSystemFileHandle[];

    private _selectedScript: Script;
    private _loadedScripts: Script[] = [];
    private _scriptTabs: Record<string, Tab> = {};
    private _processOnVisible: boolean = false;

    private _selectedInput: string;
    private _mainInputTab: Tab;
    private _inputTabValues: Record<string, InputTab> = {};

    private _selectedOutput: string;
    private _outputTabs: Record<string, Tab> = {};
    private _tabStreams: Record<string, Stream> = {};

    private _ctlCommand: CommandPalette;
    private _ctlSidebar: Sidebar;

    public constructor()
    {
        this._ctlCommand = document.querySelector("#cmdMain");
        this._ctlSidebar = document.querySelector("#sidebar");

        this._btCopy = document.querySelector("#btCopyToClip");
        this._btCopy.addEventListener("click", () => this._txtOutput.copyToClipboard());

        this._btFolder = document.querySelector("#btFolder");
        this._btFolder.addEventListener("click", () => this.selectFolder());

        this._btFiles = document.querySelector("#btFiles");
        this._btFiles.addEventListener("click", () => this.selectFiles());

        let btHelp = document.querySelector("#btHelp");
        btHelp.addEventListener("click", () => { setTimeout(() => this._ctlCommand.show(),0); } );
        this._ctlCommand.addEventListener("onHide", () => { setTimeout(() => this._txtEditor.rawTextArea.focus(),0); } );

        let chkRawText = document.querySelector("#chkRawText") as HTMLInputElement;
        chkRawText.addEventListener("change", () => this._txtOutput.alwaysTextArea = !chkRawText.checked);

        let chkAuto = document.querySelector("#chkAuto") as HTMLInputElement;
        chkAuto.addEventListener("change", () => this.updateAutoState());

        let btRun = document.querySelector("#btRun") as HTMLInputElement;
        btRun.addEventListener("click", () => this.process(true));

        this._txtInput = document.querySelector("#txtInput");
        this.setupTextArea(this._txtInput, true);
        this._tbInput = document.querySelector("#tbInput");
        let btNewIn = this._tbInput.addFixedTab("+");
        this._tbInput.addEventListener("tabSelected", (e:any) => this.switchInputs(e.detail.key))
        this._mainInputTab = this.generateNewInput(true);
        btNewIn.addEventListener("tabclick", () => this.generateNewInput(false));

        this._txtOutput = document.querySelector("#txtOutput");
        this._tbOutput = document.querySelector("#tbOutput");
        let tabStream = this._tbOutput.addTab("Output", STREAM);
        this._outputTabs[STREAM] = tabStream;
        this._tbOutput.selectTab(tabStream); // select before the event listener is attached
        this._tbOutput.addEventListener("tabSelected", (e:any) => this.switchOutputs(e.detail.key));

        this._lblError = document.querySelector("#lblError");

        this._txtEditor = document.querySelector("#txtSource");
        this.setupEditor(this._txtEditor);

        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.setupCommands();
            this.process();
        }, 0);

        this._tbEditor = document.querySelector("#tbSource");
        this._tbEditor.addEventListener("tabSelected", (ev:any) => this.onSwitchToTab(ev.detail.tab));
        var btAddScript = this._tbEditor.addFixedTab("+");
        btAddScript.addEventListener("tabclick", () => this.generateNewScript())

        this.loadTabs();
        window.addEventListener("storage", e => this.resyncTabs());
        document.addEventListener("visibilitychange", e => { 
            if(!document.hidden && this._processOnVisible){
                this._processOnVisible = false;
                this.process();
            }
        } );
        this.updateAutoState();
    }

    private setupCommands(){
        for (const help of _loadedHelpPages) {
            let type = eCommandType.concept;
            if(help.type === "functions") type = eCommandType.function;
            if(help.type === "concepts") type = eCommandType.concept;
            if(help.type === "how to") type = eCommandType.howTo;
            let search = help.title + "\n" + help.content;
            let content = `
                <h1>${help.title}</h1>
                <div>${help.content}</div>
            `;
            this._ctlCommand.registerCommand(help.title, type, i => this._ctlSidebar.show(content), search);
        }
        this._ctlCommand.indexCommands();
    }

    private setupEditor(area: CodeInput){
        area.addEventListener("input", () => this.queueProcess());
        area.addEventListener("keydown", e => { // need to allow inserting tabs
            if(e.key == 'Tab') {
                e.preventDefault();
                var start = area.selectionStart;
                var end = area.selectionEnd;
                var possibleAdds = HefeHighlighter.GetSuggestions(area.rawTextArea, end);
                if(possibleAdds.toInsert){
                    let symbol = possibleAdds.toInsert.symbol;
                    area.value = area.value.substring(0, possibleAdds.atStart)
                        + symbol
                        + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = possibleAdds.atStart + symbol.length;
                }
                else{
                    area.value = area.value.substring(0, start) + '\t' + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start + 1;
                }
                this.queueProcess();
            }
            if(e.key == "Enter"){
                if(e.ctrlKey){
                    let pos = area.selectionEnd;
                    let lines = area.value.split("\n");
                    let curY = 0;
                    for (curY = 0; curY < lines.length; curY++) {
                        let ln = lines[curY].length;
                        if(pos <= ln) break;
                        pos -= (ln + 1);
                    }
                    if(this.DebugLine == curY) curY = 99999999;
                    this.DebugLine = curY;
                    area.update(area.value);
                    this.process(true);
                    e.preventDefault();
                }
            }
        });
        area.addEventListener("dragover", () => area.classList.add("dropping"), false);
        area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", () => area.classList.remove("dropping"), false);
        area.addEventListener("drop", event => this.onFileDropped(event, area as any));
    }

    private setupTextArea(area: HTMLTextAreaElement, hookEvents: boolean){
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
    }

    private loadTabs(){
        let array : Script[] = [];
        for (const key of this.getScriptKeys()) {
            array.push(new Script(key));
        }
        if(array.length == 0) { array.push(new Script()); }
        array.sort((a,b) => b.LastEdit.getTime() - a.LastEdit.getTime());
        for(let script of array){
            this.makeTab(script);
        }
        this.switchToTab(array[0]);
    }
    private getScriptKeys(): string[]{
        let array : string[] = [];
        for (let i = 0; i < localStorage.length; i++){
            let key = localStorage.key(i);
            if(key.startsWith("hefe")){
                array.push(key);
            }
        }
        return array;
    }
    private resyncTabs() {
        console.log("Updating from local storage");
        for (const key of this.getScriptKeys()){
            if(this._scriptTabs[key] == null){
                this.makeTab(new Script(key));
            }
            let tab = this._scriptTabs[key];
            let script = this._loadedScripts.find(s => s.Key == key);
            script.Save
            if(!tab || !script) continue;
            if(!script.Reload()) continue;
            tab.name = script.Name;
            if(this._tbEditor.selectedTab === tab){
                this._txtEditor.value = script.Code ?? "";
                if(document.hidden) this._processOnVisible = true;
                else this.process();
            }
        }

    }
    private makeTab(script: Script, inFront?: boolean): Tab {
        let tab = this._tbEditor.addTab(script.Name, script.Key, inFront);
        this._loadedScripts.push(script);
        this._scriptTabs[script.Key] = tab;
        tab.renameHook = s => s.trim();
        tab.addEventListener("changeLabel", (ev:any) => {
            script.Name = ev.detail.value;
            this._txtEditor.rawTextArea.focus();
            script.Save();
        });
        return tab;
    }
    private generateNewScript(){
        let script = new Script();
        let id = this._loadedScripts.filter(s=>s.Name.startsWith("temp ")).length + 1;
        script.Name = "temp " + id;
        this.makeTab(script, true);
        script.Save();
        this.switchToTab(script);
    }
    private switchToTab(script: Script){
        this._tbEditor.selectTab(this._scriptTabs[script.Key]);
    }
    private onSwitchToTab(tab: Tab){
        let script = this._loadedScripts.find(s => s.Key == tab.key);
        this._selectedScript = script;
        if(!script) return;
        this._txtEditor.value = script.Code ?? "split";
        this.process(true);
    }


    private switchInputs(key: string){
        if(this._selectedInput == key) return;
        if(this._selectedInput){
            this._inputTabValues[this._selectedInput].value = this._txtInput.value;
        }
        this._selectedInput = key;
        this._txtInput.value = this._inputTabValues[key].value;
    }
    private generateNewInput(isMainInput: boolean): Tab{
        let name = "";
        if(isMainInput){
            name = INPUT;
        }else{
            for (let index = 1; index < 999 ; index++) {
                name = "in" + index;
                if(!Object.values(this._inputTabValues).find(t => t.tab.name == name))
                    break;
            }
        }
        let key = "k" + Date.now();
        let tab = this._tbInput.addTab(name, key);
        if(!isMainInput) tab.renameHook = s => s.replaceAll(' ', '');
        this._inputTabValues[key] = {value: "", tab: tab };
        this._tbInput.selectTab(tab);
        if(!isMainInput) this.process();
        return tab;
    }
    private getVariableValue(name: string){
        var active = this._inputTabValues[this._selectedInput];
        if(active.tab.name == name)
            return this._txtInput.value;
        for (const tab of Object.values(this._inputTabValues)) {
            if(tab.tab.name == name)
                return tab.value;
        }
        return "";
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
            this._inputTabValues[this._selectedInput].tab.name = file.name;
            this.process();
        };
        reader.readAsText(file);
    }

    public queueProcess(){
        setTimeout(() => this.process(), 250);
    }

    public process(force?: boolean){
        let btRun = document.querySelector("#btRun") as HTMLInputElement;
        btRun.classList.toggle("tbHighlight", true);
        if(!this.isAutoRun && !force) { return; }
        btRun.classList.toggle("tbHighlight", false);
        try{
            const code = this._txtEditor.value;
            if(this._selectedScript != null && this._selectedScript.Code != code){
                this._selectedScript.Code = code;
                this._selectedScript.Save();
            }
            
            this.asyncProcess(code, this.DebugLine);
        }
        catch(err){
            this.ShowError(err);
        }
    }
    public async asyncProcess(code: string, debugLine: number){
        try{
            var parse = Parser.Parse(code);
            HefeHighlighter.CustomSymbols = Array.from(parse.identifiers).map(s => {return {symbol: s, display:s};});
            for (const func of Object.values(parse.functionDefs)) {
                HefeHighlighter.CustomSymbols.push({symbol: func.name + "(", display: func.displayDef});
            }

            let inVars: Record<string, string> = {};
            for (const tab of Object.values(this._inputTabValues)) {
                var name = tab.tab.name;
                if(name != "") 
                    inVars[name] = this.getVariableValue(name);
            }
            const input = {
                text: this.getVariableValue(INPUT),
                fileName: this._selectedInput,
                variables: inVars,
                folder: new VirtualFolder(this._selectFolder, this._selectedFiles),
            }
            let res = await Interpreter.Process(input, parse, debugLine);
            if(res != null)
            {
                let outVars = Object.keys(res.variables);
                outVars = outVars.filter(v => v != "fileName" && inVars[v] == null); // not useful
                outVars.push(STREAM);

                let uniqCounter: Record<string, number> = {};
                this._tabStreams = {}; // I don't love keeping the streams in memory, but re-running is also annoying
                let vTabs = this._tabStreams;

                let getName = (name: string):string => {
                    // make sure names are unique for side outputs
                    if(name in uniqCounter) {
                        uniqCounter[name]++;
                        return `${name} [${uniqCounter[name]}]`;
                    }
                    uniqCounter[name] = 0;
                    return name;
                };

                let addTab = (name: string, stream: Stream) => {
                    let fixName = getName(name);
                    if(this._outputTabs[fixName] == null){
                        this._outputTabs[fixName] = this._tbOutput.addTab(fixName,fixName);
                    }
                    vTabs[fixName] = stream;
                }

                addTab(STREAM, res.output);
                for (const v of outVars) {
                    if(v !== STREAM){
                        addTab(v, res.variables[v]);
                    }
                }
                for(const [name, stream] of res.sideOutputs){
                    addTab(name, stream);
                }

                for (const v of Object.keys(this._outputTabs)) {
                    if(!(v in vTabs)){
                        this._tbOutput.removeTab(this._outputTabs[v]);
                        delete this._outputTabs[v];
                    }
                }

                if(!this._outputTabs[this._selectedOutput]){
                    this._selectedOutput = STREAM;
                    this._tbOutput.selectTab(this._outputTabs[STREAM]);
                }

                this._txtOutput.stream = vTabs[this._selectedOutput]; // always write in case of change
                
                if(res?.error)
                    this.ShowError(res.error);
                else {
                    this._lblError.textContent = "";
                    this.ErrorLine = 99999999;
                }
                
                this._txtEditor.refresh();
            }
        } catch(err){this.ShowError(err);}
    }

    private switchOutputs(key: string){
        if(this._selectedOutput == key) return;
        this._selectedOutput = key;
        this._txtOutput.stream = this._tabStreams[this._selectedOutput]; // FRAGILE!
    }

    private ShowError(err:Error){
        if(err instanceof LineError){
            this.ErrorLine = err.Line;
            this._txtEditor.refresh();
        }
        console.log("error:", err);
        this._lblError.textContent = err.message;
    }

    private async selectFiles() {
        try {
            // Show file picker (requires browser support)
            this._selectedFiles = await (window as any).showOpenFilePicker({
                multiple: true,
            }); // TODO: ts rejects type checking? Also, do something in unsupported browsers
            if(this._selectedFiles) {
                document.querySelector("#lblFolder").textContent = `\\[${this._selectedFiles.length} files]`;
                this._selectFolder = null;
            }
            this.process();
        } catch (err) {
            this.ShowError(err);
        }
        this.updateAutoState();

    }

    private async selectFolder() {
        try {
            // Show folder picker (requires browser support)
            this._selectFolder = await (window as any).showDirectoryPicker(); // TODO: ts rejects type checking? Also, do something in unsupported browsers
            if(this._selectFolder) {
                document.querySelector("#lblFolder").textContent = "\\" + this._selectFolder.name;
                this._selectedFiles = null;
            }
            this.process();
        } catch (err) {
            this.ShowError(err);
        }
        this.updateAutoState();
    }

    private updateAutoState(){
        let chkAuto = document.querySelector("#chkAuto") as HTMLInputElement;
        if(this._selectFolder || this._selectedFiles){
            chkAuto.checked = false;
            chkAuto.disabled = true;
        }
        let btRun = document.querySelector("#btRun") as HTMLInputElement;
        btRun.classList.toggle("noDisp", this.isAutoRun);
    }
    private get isAutoRun(): boolean { return (document.querySelector("#chkAuto") as HTMLInputElement).checked; }
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
            this.Name = (new Date()).toDateString();
            this.Code = "";
            this.LastEdit = new Date();
        } else{
            this.Key = key;
            this.Reload();
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
    public Reload(): boolean{
        const obj = JSON.parse(localStorage.getItem(this.Key)) as IScriptJson;
        if(JSON.stringify(this.LastEdit) === obj.edit) return false;
        this.Name = obj.name;
        this.LastEdit = new Date(JSON.parse(obj.edit));
        this.Code = obj.code;
        if(this.Name == "") this.Name = (new Date()).toDateString();
        return true;
    }
}

interface IScriptJson {
    name: string;
    edit: string;
    code: string;
}

class HefeHighlighter extends Template{
    static CustomSymbols: CompMatch[] = [];
    static BuiltInSymbols: CompMatch[];
    private _workspace: Workspace;
    public constructor(workSpace: Workspace)
    {
        super(true, true, true, [new Autocomplete(HefeHighlighter.updatePopup)]);
        this._workspace = workSpace;
        HefeHighlighter.BuiltInSymbols = Interpreter.getBuiltinSymbols();
    }
    public highlight(resultElement: Element, ctl?: CodeInput): void {
        let htmlResult: string[] = [];
        let lines = ctl.value.split("\n");
        let baseSymbols = new Set<string>(HefeHighlighter.BuiltInSymbols.map(c => c.symbol));
        for (let i = 0; i < lines.length; i++) {
            if(i > 0) htmlResult.push("</br>");
            let code = lines[i];
            if(i == this._workspace.DebugLine){
                htmlResult.push(`<span style="color:#F1D815">${ctl.escape_html(code + "  <<DEBUG>>")}</span>`);
                continue;
            }
            if(i == this._workspace.ErrorLine){
                htmlResult.push(`<span style="color:#BF4938">${ctl.escape_html(code + "  <<ERROR>>")}</span>`);
                continue;   
            }
            try{
                let lex = Lexer.Tokenize(code);

                for (let pos = 0; pos < code.length; pos++) {
                    const symb = code[pos];
                    const toke = Lexer.getTokenAt(lex.details, pos);
                    const type = toke?.type;
                    const color = HefeHighlighter.getColor(type);
                    htmlResult.push(`<span style="color: ${color}">${ctl.escape_html(symb)}</span>`);
                }
            } catch{
                htmlResult.push(`<span style="color:#BF4938">${ctl.escape_html(code)}</span>`);
            }
        }
        // extra space makes sure the pre height matches the inner text area
        htmlResult.push(`<span style="color:#BF4938">&nbsp;</span>`);
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
            elems.push(`<div class=suggest>${suggest.display}</div>`);
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
                    if(HefeHighlighter.BuiltInSymbols.find(s => s.symbol == curr)) return {possible:[]};
                    let arr = HefeHighlighter.BuiltInSymbols.concat(HefeHighlighter.CustomSymbols);
                    let scored: CompMatchScore[] = arr
                        .map(s => {return {match:s, score: HefeHighlighter.match(curr, s.symbol)}})
                        .filter(s => s.score >= 10)
                        .sort((a,b) => b.score - a.score); // lower idx better
                    if(scored.length == 0) return {possible:[]}
                    
                    const possible = scored.map(s => s.match);
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

interface InputTab{
    tab: Tab;
    value: string;
}

export interface CompMatch{
    symbol: string;
    display: string;
}

interface CompMatchScore{
    match: CompMatch;
    score: number;
}

interface CompMatchSuggestion{
    possible: CompMatch[];
    toInsert?: CompMatch;
    atStart?: number;
}

let _loadedHelpPages: HelpPage[] = [];
export interface HelpPage{
    title: string;
    content: string;
    type: string;
}
export function regHelp(pages: HelpPage[]){
    _loadedHelpPages.push(...pages);
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace();
    const _highlighter = new HefeHighlighter(_instance);
    CodeInput.registerTemplate("def", _highlighter);
});