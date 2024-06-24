export class Sidebar extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: "open" });
        shadow.append(Sidebar._tmplt.content.cloneNode(true));
        this.container = shadow.querySelector("#sidebar");
        this.content = shadow.querySelector("#content");
        this.btClose = shadow.querySelector("#closebtn");
    }
    connectedCallback() {
        this.btClose.addEventListener("click", () => {
            this.hide();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                this.hide();
            }
        });
    }
    show(content) {
        this.content.innerHTML = content;
        this.container.style.right = "0";
    }
    hide() { this.container.style.right = "-350px"; }
}
Sidebar._tmplt = mkTmplt(`
        <div id="sidebar">
            <div id="label">Help</div>
            <a href="javascript:void(0)" id="closebtn">×</a>
            <div id="content"></div>
        </div>
        <style>
            #sidebar {
                height: 100%;
                top: 0;
                width: 350px;
                right: -350px;
                position: fixed;
                background-color: #111;
                overflow-x: hidden;
                transition: 0.5s;
                padding-top: 60px;
            }
            #sidebar a {
                padding: 8px 8px 8px 32px;
                text-decoration: none;
                font-size: 25px;
                color: #818181;
                display: block;
                transition: 0.3s;
            }
            #sidebar a:hover {
                color: #f1f1f1;
            }
            #label {
                position: absolute;
                top: 0;
                left: 5px;
                font-size: 36px;
                padding: 8px;
            }
            #content {
                padding: 15px;
            }
            #sidebar #closebtn {
                position: absolute;
                top: 0;
                right: 5px;
                font-size: 36px;
            }
            .openbtn {
                font-size: 20px;
                cursor: pointer;
                background-color: #111;
                color: white;
                padding: 10px 15px;
                border: none;
            }
            .openbtn:hover {
                background-color: #444;
            }
        </style>
    `);
function mkTmplt(innerHtml) {
    var tmplt = document.createElement("template");
    tmplt.innerHTML = innerHtml;
    return tmplt;
}
customElements.define("side-bar", Sidebar);
//# sourceMappingURL=sidebar.js.map