export class Workspace {
    constructor(pane) {
        this._paneMain = pane;
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn", true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut", false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));
        let prevCode = localStorage.getItem("jsCode");
        if (prevCode == null || prevCode == "") {
            prevCode = 'let a = all; \nlet b = split;\nconst c = b.map(l => "-" + l);\nreturn c.join("\\n");';
        }
        this._txtEditor.value = prevCode;
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
            this.process();
        };
        reader.readAsText(file);
    }
    makeTextArea(className, hookEvents) {
        let area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        if (hookEvents) {
            area.addEventListener("input", () => this.process());
            area.addEventListener("dragover", () => area.classList.add("dropping"), false);
            area.addEventListener("dragleave", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", () => area.classList.remove("dropping"), false);
            area.addEventListener("drop", event => this.onFileDropped(event, area));
        }
        return area;
    }
    process() {
        //const a = new Parser();
        //console.log("woot!");
        try {
            const code = this._txtEditor.value;
            localStorage.setItem("jsCode", code);
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