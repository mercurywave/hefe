import { Stream } from "./stream";

export class StreamDisplay extends HTMLElement {
    static _tmplt = mkTmplt(`
        <div id="container">
            <textarea id="txt" class="fill"></textarea>
            <div id="scrollable" class="fill">
                <table id="tbl"></table>
            </div>
        </div>
        <style>
            .fill{
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                position: absolute;
                width: 100%;
                height: 100%;
            }
            #container{
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                position: absolute;
                vertical-align: top;
            }
            #txt{
                background-color: #3E3D5F;
                color: #FFF;
                white-space: pre;
                overflow-wrap: normal;
                overflow-x: auto;
                tab-size: 4;
                resize: none;
                padding: 10px;
            }                
            #txt:focus-within{
                outline: 1px solid #fff;
                border-radius: 2px;
            }
            #scrollable{
                width: calc(100% - 20px);
                height: calc(100% - 20px);
                padding: 10px;
                overflow: auto;
            }
            #tbl{
                margin: 0;
                padding: 0;
                font-family:monospace;
                border-spacing: 0;
                border-collapse: collapse;
            }
            td{
                border: 1px solid #666;
                padding: 0 4px;
            }
        </style>
    `);
    private _stream: Stream | null = null;
    private _alwaysTextArea: boolean = false;

    constructor() {
        super();
        const shadow = this.attachShadow({mode: "open"});
        shadow.append(StreamDisplay._tmplt.content.cloneNode(true));
    }

    static get observedAttributes() {
        return ['always-text-area'];
    }

    get stream(): Stream | null {
        return this._stream;
    }

    set stream(value: Stream | null) {
        this._stream = value;
        this.render();
    }

    get alwaysTextArea(): boolean {
        return this._alwaysTextArea;
    }

    set alwaysTextArea(value: boolean) {
        this._alwaysTextArea = value;
        this.render();
    }

    attributeChangedCallback(name: string, oldValue: any, newValue: any) {
        if (name === 'always-text-area') {
            this._alwaysTextArea = newValue !== null;
            this.render();
        }
    }

    get isTableVisible(): boolean {
        return this._stream && !this._alwaysTextArea && this._stream.isTable;
    }

    render() {
        if (!this._stream) return;

        let ctlTbl = this.shadowRoot.querySelector("#tbl") as HTMLTableElement;
        let ctlTxt = this.shadowRoot.querySelector("#txt") as HTMLTextAreaElement;
        let ctlScroll = this.shadowRoot.querySelector("#scrollable") as HTMLDivElement;

        ctlScroll.style.display = "none";
        ctlTxt.style.display = "none";

        if (!this.isTableVisible) {
            ctlTxt.value = this._stream.toDisplayText();
            ctlTxt.style.display = "block";
        } else {
            ctlTbl.innerHTML = "";
            this._stream.asArray().forEach(child => {
                const row = document.createElement('tr');
                child.asArray().forEach(node => {
                    const cell = document.createElement('td');
                    cell.textContent = node.toDisplayText();
                    row.appendChild(cell);
                });
                ctlTbl.appendChild(row);
            });
            ctlScroll.style.display = "block";
        }
    }

    public async copyToClipboard(){
        if(!this.stream) return;
        let isSuccess = true;
        if(this.isTableVisible){
            let ctlScroll = this.shadowRoot.querySelector("#scrollable") as HTMLDivElement;
            var range = document.createRange();
            range.selectNode(ctlScroll);
            console.log(range);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            // there does not appear to be a perfect replacement for this function
            // this copies the style, which is annoying, but at least it copies the table
            // that could be worked around by copying the dom and stripping styles
            // fairly annoying to implement, and not a common use case
            isSuccess = document.execCommand('copy'); 
        }
        else
        {
            let ctlTxt = this.shadowRoot.querySelector("#txt") as HTMLTextAreaElement;
            ctlTxt.select();
            ctlTxt.setSelectionRange(0, 9999999);
            await navigator.clipboard.writeText(this.stream.toDisplayText());
        }
        if(isSuccess)
            console.log("copied to clipboard");
        else
            console.log("failed to copy to clipboard");
    }
}

function mkTmplt(innerHtml): HTMLTemplateElement{
    var tmplt = document.createElement("template");
    tmplt.innerHTML = innerHtml;
    return tmplt;
}

customElements.define('stream-display', StreamDisplay);