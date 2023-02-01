export class Workspace {
    constructor(pane) {
        this._paneMain = pane;
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn", true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut", false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));
        this._txtEditor.value = `
            let a = all;
            let b = split;
            return b.join("\\n");
        `;
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
            this._txtOutput.value = "" + err;
        }
    }
}
let _instance;
document.addEventListener("DOMContentLoaded", () => {
    _instance = new Workspace(document.getElementById("paneMain"));
});
//# sourceMappingURL=main.js.map