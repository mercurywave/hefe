import { Parser } from "./interpreter.js";

export class Workspace {
    
    private _paneMain : HTMLElement;
    private _txtInput : HTMLTextAreaElement;
    private _txtOutput : HTMLTextAreaElement;
    private _txtEditor : HTMLTextAreaElement;

    public constructor(pane: HTMLElement)
    {
        this._paneMain = pane;
        pane.addEventListener("dragover", () => pane.classList.add("dropping"), false);
        pane.addEventListener("dragleave", () => pane.classList.remove("dropping"), false);
        pane.addEventListener("drop", () => pane.classList.remove("dropping"), false);
        pane.addEventListener("drop", event => this.onFileDropped(event));
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn",true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut",false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd",true));

        let prevCode = localStorage.getItem("jsCode");
        if(prevCode == null || prevCode == ""){
            prevCode = 'let a = all; \nlet b = split;\nconst c = b.map(l => "-" + l);\nreturn c.join("\\n");'
        }
        this._txtEditor.value = prevCode;
    }

    private onFileDropped(ev: DragEvent){
        if(ev.dataTransfer.items){
            for (const item of ev.dataTransfer.items) {
                if (item.kind === 'file') {
                    ev.preventDefault();
                    this.readFile(item.getAsFile());
                }
            }
        }
    }

    private readFile(file: File){
        console.log(file);
        let reader = new FileReader();
        reader.onload = ev => {
            this._txtInput.value = reader.result.toString();
            this.process();
        };
        reader.readAsText(file);
    }

    private makeTextArea(className:string, hookEvents: boolean) {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        area.addEventListener("input", () => this.process());
        return area;
    }

    public process(){
        //const a = new Parser();
        //console.log("woot!");
        try{
            const code = this._txtEditor.value;
            localStorage.setItem("jsCode", code);
            const exec = new Function("all", "split", code);
            const all = this._txtInput.value;
            const split = all.split("\n");
            const ret = exec(all, split);
            this._txtOutput.value = ret;
        }
        catch(err){
            this.ShowError(err);
        }
    }

    private ShowError(err){
        this._txtOutput.value = "" + err;
    }
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});