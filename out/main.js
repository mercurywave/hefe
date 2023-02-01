var Workspace = /** @class */ (function () {
    function Workspace(pane) {
        this._paneMain = pane;
        this._txtInput = pane.appendChild(this.makeTextArea("txtIn", true));
        this._txtOutput = pane.appendChild(this.makeTextArea("txtOut", false));
        this._txtEditor = pane.appendChild(this.makeTextArea("txtEd", true));
    }
    Workspace.prototype.makeTextArea = function (className, hookEvents) {
        var area = document.createElement("textarea");
        area.setAttribute("spellcheck", "false");
        area.className = className;
        area.addEventListener("input", this.process);
        return area;
    };
    Workspace.prototype.process = function () {
        console.log("woot!");
    };
    return Workspace;
}());
var _instance;
document.addEventListener("DOMContentLoaded", function () {
    _instance = new Workspace(document.getElementById("paneMain"));
});
//# sourceMappingURL=main.js.map