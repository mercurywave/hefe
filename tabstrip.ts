
export class TabStrip extends HTMLElement {
    static _tmplt = mkTmplt(`
        <div class="bottomBar">
            <span id="fixed" class="tabList"></span>
            <span id="list" class="tabList"></span>
        </div>
        <style>
            .bottomBar{
                position: relative;
                bottom: 5px;
                left: 0;
                width: 100%;
                height: 1.5em;
                overflow-x: scroll;
                margin-left: 10;
                margin-right: 10;
                display: inline-block;
                white-space: nowrap;
            }
            .bottomBar::-webkit-scrollbar{
                display: none;
            }
            .tabList{
                display: inline-block;
                white-space: nowrap;
            }
        </style>
    `);
    private _mainTabs: HTMLSpanElement;
    private _fixedTabs: HTMLSpanElement;
    private _selectedTab: Tab;
    constructor(){
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.append(TabStrip._tmplt.content.cloneNode(true));
        this._mainTabs = shadow.querySelector("#list");
        this._fixedTabs = shadow.querySelector("#fixed");
    }

    connectedCallback(){
        this.addEventListener('wheel', e => this._mainTabs.scrollLeft += e.deltaY)
    }

    public addTab(label: string, key: string, inFront?: boolean): Tab{
        var tab = this.addTabTo(this._mainTabs, inFront, label, key);
        tab.addEventListener("click", () => this.selectTab(tab));
        return tab;
    }
    public insertTab(label: string, key: string): Tab{
        var tab = this.addTabTo(this._mainTabs, true, label, key);
        tab.addEventListener("click", () => this.selectTab(tab));
        return tab;
    }
    public selectTab(tab: Tab) {
        if(this._selectedTab != null){
            this._selectedTab.setAttribute("selected", "false");
            this._selectedTab = null;
        }
        this._selectedTab = tab;
        tab.setAttribute("selected", "true");
        this.dispatchEvent(new CustomEvent("tabSelected", {
            detail: {tab: tab, key: tab.key}
        }));
    }
    public addFixedTab(label: string, key?: string): Tab{
        var tab = this.addTabTo(this._fixedTabs, false, label, key);
        tab.addEventListener("tabclick", () => this.dispatchEvent(new CustomEvent("fixedTabClick", {
            detail: { key: key }
        })));
        return tab;
    }
    private addTabTo(elem: HTMLSpanElement, inFront: boolean, label: string, key?: string): Tab{
        let tab = new Tab();
        tab.key = key;
        tab.innerText = label;
        if(inFront) elem.prepend(tab);
        else elem.appendChild(tab);
        return tab;
    }
}

export class Tab extends HTMLElement {
    static _tmplt = mkTmplt(`
        <span id="tab" class="tab">
            <span class="lbl">
                <slot></slot>
            </span>
            <input id="txtRename" type="text" />
        </span>
        <style>
            .tab{
                padding: 2 10;
                font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                cursor: pointer;
            }
            .selected{
                background-color: #646281;
                border: .5px solid #aaa;
            }
            .editing .lbl{
                display: none;
            }
            .tab:not(.editing) input{
                display: none;
            }
            .tab input{
                width: 120px;
            }
        </style>
    `);
    public key: string;
    public renameHook: (input: string) => string;
    private _selected: boolean;
    constructor(){
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.append(Tab._tmplt.content.cloneNode(true));
    }

    static get observedAttributes() {
        return ['selected'];
    }
    attributeChangedCallback(name, oldValue, newValue){
        if(name == "selected"){
            this._selected = (newValue == "true");
            let elem = this.shadowRoot.querySelector("#tab");
            if(oldValue == "true") elem.classList.remove("selected");
            if(this._selected) elem.classList.add("selected");
        }
    }
    connectedCallback(){
        var elem = this.shadowRoot.querySelector("#tab");
        elem.addEventListener("click", (ev) => this.onClick(ev));
        let txtName = this.shadowRoot.querySelector("#txtRename") as HTMLInputElement;
        let commit = () => {
            var txt = txtName.value;
            if(txt == "") txt = "???";
            this.innerText = txt;
            txtName.value = txt;
            this.dispatchEvent(new CustomEvent("changeLabel", {detail: { value: txt } }));
            elem.classList.remove('editing');
        };
        txtName.addEventListener('change', e => {
            txtName.value = this.renameHook(txtName.value);
        });
        txtName.addEventListener('keyup', e => {
            if(e.key === 'Enter') commit();
        });
        txtName.addEventListener('blur', () => {
            commit();
        });
    }
    private onClick(event: Event){
        var elem = this.shadowRoot.querySelector("#tab");
        if(this.renameHook && this._selected) {
            if(!elem.classList.contains("editing")) {
                let txtName = this.shadowRoot.querySelector("#txtRename") as HTMLInputElement;
                txtName.value = this.innerText;
                elem.classList.add('editing');
                txtName.focus();
            }
        }
        else {
            this.dispatchEvent(new CustomEvent("tabclick", {
                detail: {key:this.key}
            }))
        }
    }
}

function mkTmplt(innerHtml): HTMLTemplateElement{
    var tmplt = document.createElement("template");
    tmplt.innerHTML = innerHtml;
    return tmplt;
}

customElements.define("tab-strip", TabStrip);
customElements.define("tab-label", Tab);