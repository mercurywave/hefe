export class Workspace {
    constructor(pane) {
        this._paneMain = pane;
        pane.addEventListener("drop", event => this.onFileDropped(event));
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn", true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut", false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));
        this._txtEditor.value = `
let a = all;
let b = split;
const c = b.map(l => "-" + l);
return c.join("\\n");
        `;
    }
    onFileDropped(ev) {
        if (ev.dataTransfer.items) {
            for (const item of ev.dataTransfer.items) {
                if (item.kind === 'file') {
                    ev.preventDefault();
                    this.readFile(item.getAsFile());
                }
            }
        }
    }
    readFile(file) {
        console.log(file);
        let reader = new FileReader();
        reader.onload = ev => {
            this._txtInput.value = reader.result.toString();
            this.process();
        };
        reader.readAsText(file);
    }
    makeTextArea(className, hookEvents) {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        area.addEventListener("input", () => this.process());
        return area;
    }
    process() {
        //const a = new Parser();
        //console.log("woot!");
        try {
            const code = this._txtEditor.value;
            const exec = new Function("all", "split", code);
            const all = this._txtInput.value;
            const split = all.split("\n");
            const ret = exec(all, split);
            this._txtOutput.value = ret;
        }
        catch (err) {
            this.ShowError(err);
        }
    }
    ShowError(err) {
        this._txtOutput.value = "" + err;
    }
}
let _instance;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});
//# sourceMappingURL=main.js.map