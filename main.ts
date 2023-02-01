import { Parser } from "./interpreter.js";

export class Workspace {
    
    private _paneMain : HTMLElement;
    private _txtInput : HTMLTextAreaElement;
    private _txtOutput : HTMLTextAreaElement;
    private _txtEditor : HTMLTextAreaElement;

    public constructor(pane: HTMLElement)
    {
        this._paneMain = pane;
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn",true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut",false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd",true));
        this._txtEditor.value = `
            let a = all;
            let b = split;
            return b.join("\\n");
        `;
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
            const exec = new Function("all", "split", code);
            const all = this._txtInput.value;
            const split = all.split("\n");
            const ret = exec(all, split);
            this._txtOutput.value = ret;
        }
        catch(err){
            this._txtOutput.value = "" + err;
        }
    }
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});