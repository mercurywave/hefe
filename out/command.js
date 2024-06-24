export class CommandPalette extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.append(CommandPalette._tmplt.content.cloneNode(true));
        this.container = shadow.querySelector("#command-palette");
        this.input = shadow.querySelector("#command-input");
        this.commandList = shadow.querySelector("#command-list");
        this.noResults = shadow.querySelector("#unknown-text");
    }
    connectedCallback() {
        this.input.addEventListener("input", () => {
            this.showCommands(this.input.value);
        });
        this.input.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                this.input.value = "";
                this.hide();
            }
            if (e.key === "ArrowUp") {
                this.moveSelection(-1);
                e.preventDefault();
            }
            if (e.key === "ArrowDown") {
                this.moveSelection(1);
                e.preventDefault();
            }
            if (e.key === "Enter") {
                this.tryRunSelected();
            }
        });
        this.commandList.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                this.tryRunSelected();
            }
        });
        this.commandList.addEventListener("click", e => {
            this.tryRunSelected();
        });
        this.commandList.addEventListener("focus", e => {
            this.input.focus();
        });
        document.addEventListener("keydown", e => {
            if (e.ctrlKey && (e.key === "," || e.key === ".")) {
                this.show();
            }
        });
        document.addEventListener("click", e => {
            if (!this.contains(e.target)) {
                this.hide();
            }
        });
    }
    show() {
        this.showCommands(this.input.value);
        this.container.style.display = "block";
        this.input.focus();
    }
    hide() {
        this.container.style.display = "none";
    }
    moveSelection(delta) {
        let prev = this.commandList.selectedIndex;
        let target = prev + delta;
        if (target < 0)
            target = 0;
        if (target >= this.commands.length)
            target = prev;
        this.commandList.selectedIndex = target;
    }
    tryRunSelected() {
        let idx = this.commandList.selectedIndex;
        if (idx < 0 || idx >= this.commands.length)
            return;
        let cmd = this.commands[idx];
        cmd.action(this.input.value);
    }
    showCommands(rawInput) {
        this.commands = this.search(rawInput);
        this.commandList.innerHTML = "";
        for (var i = 0; i < this.commands.length; i++) {
            var item = document.createElement("option");
            item.textContent = this.commands[i].title;
            this.commandList.appendChild(item);
        }
        let num = this.commandList.children.length;
        this.commandList.setAttribute("size", "" + (num > 1 ? num : 2));
        if (num > 0)
            this.commandList.selectedIndex = 0;
        this.commandList.style.display = (num > 0 ? "block" : "none");
        this.noResults.style.display = (num > 0 ? "none" : "block");
    }
    search(rawInput) {
        var filter = rawInput.toUpperCase();
        let list = [];
        let commands = ["split", "join", "piece", "map"];
        for (var i = 0; i < commands.length; i++) {
            let cmd = commands[i];
            if (cmd.toUpperCase().indexOf(filter) > -1) {
                list.push({
                    title: cmd,
                    action: x => console.log(cmd),
                    type: eCommandType.function
                });
            }
        }
        return list;
    }
}
CommandPalette._tmplt = mkTmplt(`
        <div id="command-palette">
            <input type="text" id="command-input" placeholder="Search...">
            <select id="command-list" size="8"></select>
            <div id="unknown-text">No Results</div>
        </div>
        <style>
            #command-palette {
                position: fixed;
                top: 5px;
                left: 50%;
                transform: translate(-50%, 0);
                display: none;
                width: 300px;
                outline: 1px solid #fff;
                background-color: #fff;
                padding: 10px;
                box-shadow: 0px 0px 10px rgba(0,0,0,0.1);
                background-color: #3E3D5F;
            }
            #command-palette input {
                width: 100%;
                padding: 5px;
                box-sizing: border-box;
            }
            #command-list {
                width: 100%;
                padding: 0;
                margin: 0;
            }
            #command-list option {
                padding: 5px;
                cursor: pointer;
                color: #fff;
            }
            #command-list option:checked {
                /* you apparently can't really style the selected element, but you can fill it with a raw 1x1 gif of the color */
                /* the color doesn't really do anything here */
                background: #646281 repeat url("data:image/gif;base64,R0lGODdhAQABAIABAAAAAGRigSwAAAAAAQABAAACAkwBADs=");
                box-sizing: border-box;
                -moz-box-sizing: border-box;
                -webkit-box-sizing: border-box;
                border: 1px solid #fff;
            }
            #command-list option:hover {
                background-color: #646281;
            }
            #unknown-text {
                color: #aaa;
                font-style: italic;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                text-align: center;
                display: none;
                margin: 5px;
            }
            select {
                background: transparent;
                overflow: -moz-hidden-unscrollable; /* Firefox */
                -ms-overflow-style: none;  /* Internet Explorer 10+ */
                border: none;
            }
            /* Hide scrollbar for Chrome, Safari and Opera */
            select::-webkit-scrollbar {
                display: none;
            }
        </style>
    `);
export var eCommandType;
(function (eCommandType) {
    eCommandType[eCommandType["function"] = 0] = "function";
    eCommandType[eCommandType["howTo"] = 1] = "howTo";
    eCommandType[eCommandType["concept"] = 2] = "concept";
    eCommandType[eCommandType["action"] = 3] = "action";
})(eCommandType || (eCommandType = {}));
function mkTmplt(innerHtml) {
    var tmplt = document.createElement("template");
    tmplt.innerHTML = innerHtml;
    return tmplt;
}
customElements.define("command-palette", CommandPalette);
//# sourceMappingURL=command.js.map