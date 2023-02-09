import { CodeInput, RainbowText, Template } from "./code-input/code-input.js";
import { Interpreter, Parser } from "./interpreter.js";
import { eTokenType, Lexer } from "./Lexer.js";

export class Workspace {
    
    private _paneMain : HTMLElement;
    private _paneToolbar : HTMLElement;
    private _lblFile : HTMLHeadingElement;
    private _lblError : HTMLHeadingElement;
    private _btCopy : HTMLInputElement;
    private _txtInput : HTMLTextAreaElement;
    private _txtOutput : HTMLTextAreaElement;
    private _txtEditor : CodeInput;

    private _fileName: string;

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
        //this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));
        this._txtEditor = this.makeEditor(pane);

        let prevCode = localStorage.getItem("jsCode");
        if(prevCode == null || prevCode == ""){
            prevCode = 'split\nfilter\n\tcontains("Yes")\njoin';
        }
        this._txtEditor.value = prevCode;
        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.process();
        }, 0);
    }

    private makeEditor(pane: HTMLElement): CodeInput{
        let area = document.createElement("code-input") as CodeInput;
        //area.setAttribute("lang", "");
        area.classList.add("ed");

        area.addEventListener("input", () => this.queueProcess());
        console.log(area);
        CodeInput.registerTemplate("def", new HefeTemplate() );
        let wrapperIn = pane.appendChild(document.createElement("div"));
        wrapperIn.className = "txtEd"
        wrapperIn.appendChild(area);
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
            localStorage.setItem("jsCode", code);
            
            this.asyncProcess(code);
        }
        catch(err){
            this.ShowError(err);
        }
    }
    public async asyncProcess(code: string){
        try{
            var parse = Parser.Parse(code);
            console.log(parse);
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
        console.log("error:");
        console.log(err);
        this._lblError.textContent = err;
    }
}

class HefeTemplate extends Template{
    public constructor()
    {
        super(true, true, true, []);
    }
    public highlight(result_element: Element, code_input?: CodeInput): void {
        let html_result = [];
        let lines = code_input.value.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if(i > 0) html_result.push("</br>");
            let code = lines[i];
            let lex = Lexer.Tokenize(code);
            for (let pos = 0; pos < code.length; pos++) {
                const symb = code[pos];
                const type = Lexer.getTokenAt(lex.details, pos);
                const color = HefeTemplate.getColor(type);
                html_result.push(`<span style="color: ${color}">${code_input.escape_html(symb)}</span>`);
            }
        }
        result_element.innerHTML = html_result.join("");
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
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});