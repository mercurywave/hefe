export class CommandPalette extends HTMLElement {
    static _tmplt = mkTmplt(`
        <div id="command-palette">
            <input type="text" id="command-input" placeholder="Search...">
            <select id="command-list" size="8"></select>
            <div id="unknown-text">No Results</div>
        </div>
        <style>
            #command-palette {
                position: fixed;
                top: 10px;
                left: 10px;
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

    private divContainer: HTMLDivElement;
    private ctlInput: HTMLInputElement;
    private divCommandList: HTMLSelectElement;
    private database: Command[] = [];
    private _index: Record<string, number> = {};
    private commands: Command[];
    private divNoResults: HTMLDivElement;
    
    constructor(){
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.append(CommandPalette._tmplt.content.cloneNode(true));
        this.divContainer = shadow.querySelector("#command-palette");
        this.ctlInput = shadow.querySelector("#command-input");
        this.divCommandList = shadow.querySelector("#command-list");
        this.divNoResults = shadow.querySelector("#unknown-text");
    }

    connectedCallback(){
        this.ctlInput.addEventListener("input", () => {
            this.showCommands(this.ctlInput.value);
        });

        this.ctlInput.addEventListener("keydown", e => {
            if(e.key === "Escape") { this.ctlInput.value = ""; this.hide(); }
            if(e.key === "ArrowUp") { this.moveSelection(-1); e.preventDefault(); }
            if(e.key === "ArrowDown") { this.moveSelection(1); e.preventDefault(); }
            if(e.key === "Enter" ) { this.tryRunSelected(); }
        });

        this.divCommandList.addEventListener("keydown", e => {
            if(e.key === "Enter" ) { this.tryRunSelected(); }
        });

        this.divCommandList.addEventListener("click", e => {
            this.tryRunSelected();
        });
        
        this.divCommandList.addEventListener("focus", e => {
            this.ctlInput.focus();
        });

        document.addEventListener("keydown", e => {
            if(e.ctrlKey && (e.key === "," || e.key === ".")) {
                this.show();
            }
        });

        document.addEventListener("click",  e => {
            if(!this.contains(e.target as HTMLElement)) {
                this.hide();
            }
        });
    }

    public show(){
        this.showCommands(this.ctlInput.value);
        this.divContainer.style.display = "block";
        this.ctlInput.focus();
    }
    public hide(){
        this.divContainer.style.display = "none";
    }

    private moveSelection(delta: number){
        let prev = this.divCommandList.selectedIndex;
        let target = prev + delta;
        if(target < 0) target = 0;
        if(target >= this.commands.length) target = prev;
        this.divCommandList.selectedIndex = target;
    }

    private tryRunSelected(){
        let idx = this.divCommandList.selectedIndex;
        if(idx < 0 || idx >= this.commands.length) return;
        let cmd = this.commands[idx];
        cmd.action(this.ctlInput.value);
    }

    private showCommands(rawInput: string){
        this.commands = this.search(rawInput);
        this.divCommandList.innerHTML = "";
        for(var i = 0; i < this.commands.length; i++) {
            var item = document.createElement("option");
            item.textContent = this.commands[i].title;
            this.divCommandList.appendChild(item);
        }
        let num = this.divCommandList.children.length;
        this.divCommandList.setAttribute("size", "" + (num > 1 ? num : 2));
        if(num > 0) this.divCommandList.selectedIndex = 0;
        this.divCommandList.style.display = (num > 0 ? "block" : "none");
        this.divNoResults.style.display = (num > 0 ? "none" : "block");
    }

    private search(rawInput: string): Command[] {
        let keywords = rawInput.split(' ').map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
        let scored : ScoredCommand[] = this.database
            .map(c => {return { cmd:c, score: this.scoreSearch(keywords, c.searchWords) };})
            .filter(s => s.score >= 10)
            .sort((a,b) => b.score - a.score); // lower idx, higher score
        return scored.slice(0,9).map(s => s.cmd);
    }
    
    public registerCommand(title: string, type: eCommandType, action: (input: string) => void, searchText: string){
        let split = searchText
            .replaceAll("\n", " ")
            .replace(/[^\w\s\']|_/g, "") // strip non-alphanumeric characters
            .split(' ')
            .map(s => s.trim().toLowerCase())
            .filter(s => s.length > 0);
        let searchWords: Record<string, number> = {};
        for (const word of split) {
            searchWords[word] = (searchWords[word] ?? 0) + 1;
        }
        let cmd = {
            title: title,
            searchWords: searchWords,
            action: action,
            type: type
        };
        this.database.push(cmd);
    }

    public indexCommands(){
        let max = 0;
        let merge : Record<string, number> = {};
        for (const cmd of this.database) {
            for (const word of Object.keys(cmd.searchWords)) {
                var amt = cmd.searchWords[word];
                merge[word] = (merge[word] ?? 0) + amt;
            }
        }
        for (const word of Object.keys(merge)) {
            if(merge[word] > max) max = merge[word];
        }
        this._index = {};
        for (const word of Object.keys(merge)) {
            this._index[word] = 100 * (max - merge[word] + 1) / (max + 1);
        }
    }

    private scoreSearch(keywords: string[], searchMap: Record<string, number>):number{
        let score = 0;
        for (const key of keywords) {
            for (const comp of Object.keys(searchMap)) {
                if(comp.startsWith(key)){
                    let amt = searchMap[comp];
                    score += amt * this._index[comp];
                }
            }
        }
        return score;
    }
}

export enum eCommandType {
    function, howTo, concept, action
}
export interface Command {
    type: eCommandType;
    title: string;
    searchWords: Record<string, number>;
    action: (input: string) => void;
}

interface ScoredCommand {
    cmd: Command;
    score: number;
}

function mkTmplt(innerHtml): HTMLTemplateElement{
    var tmplt = document.createElement("template");
    tmplt.innerHTML = innerHtml;
    return tmplt;
}

customElements.define("command-palette", CommandPalette);