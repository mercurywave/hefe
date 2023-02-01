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
    }

    private makeTextArea(className:string, hookEvents: boolean) {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        area.addEventListener("input", this.process);
        return area;
    }

    public process(){
        const a = new Parser();
        console.log("woot!");
    }
}

let _instance : Workspace;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});