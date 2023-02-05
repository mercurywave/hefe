import { Interpreter, Parser } from "./interpreter.js";
import { Lexer } from "./Lexer.js";

export class Workspace {
    
    private _paneMain : HTMLElement;
    private _paneToolbar : HTMLElement;
    private _lblFile : HTMLHeadingElement;
    private _btCopy : HTMLInputElement;
    private _txtInput : HTMLTextAreaElement;
    private _txtOutput : HTMLTextAreaElement;
    private _txtEditor : HTMLTextAreaElement;

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
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));

        let prevCode = localStorage.getItem("jsCode");
        if(prevCode == null || prevCode == ""){
            prevCode = 'let a = all;\nlet b = split;\nconst c = b.map(l => "-" + l);\nreturn c.join("\\n");'
        }
        this._txtEditor.value = prevCode;
        this._txtInput.value = "Yes|No|12|true\nNo|No|15|true\nYes|Yes|8|null";
        setTimeout(() => {
            this.process();
        }, 0);
    }

    private makeTextArea(className:string, hookEvents: boolean) {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        if (hookEvents){
            area.addEventListener("input", () => setTimeout(() => this.process(), 250));
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
            this.process();
            this._lblFile.textContent = "Hefe - " + file.name;
        };
        reader.readAsText(file);
    }

    public process(){
        //const a = new Parser();
        try{
            const code = this._txtEditor.value;
            localStorage.setItem("jsCode", code);
            
            //const lines = code.split("\n");
            // const lexed = lines.map(c => {
            //     try
            //     {
            //         let lex = Lexer.Tokenize(c);
            //         return lex.Tokens;
            //         //return lex.Tokens.toString();
            //     } catch(err){return err;}
            // });
            // this._txtOutput.value = lexed.join("\n").toString();
            this.asyncProcess(code);
        }
        catch(err){
            this.ShowError(err);
        }
    }
    public async asyncProcess(code: string){
        var parse = Parser.Parse(code);
        console.log(parse);
        let res = await Interpreter.Process(this._txtInput.value, parse);
        if(res.error)
            this.ShowError(res.error);
        else if(res != null)
        {
            this._txtOutput.value = res.output.toDisplayText();
        }
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
        this._txtOutput.value = "" + err;
    }
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});