// CodeInput
// by WebCoder49
// Based on a CSS-Tricks Post
export class CodeInput extends HTMLElement {
    constructor() {
        super(); // Element
        this.last_events = {}; // Last events applied; removed when changed so can be added to textarea, etc.
    }
    /* Run this event in all plugins with a optional list of arguments */
    plugin_evt(id, args) {
        if (!this.template)
            return;
        // Run the event `id` in each plugin
        for (let i in this.template.plugins) {
            let plugin = this.template.plugins[i];
            if (id in plugin) {
                if (args === undefined) {
                    plugin[id](this);
                }
                else {
                    plugin[id](this, ...args);
                }
            }
        }
    }
    /* Syntax-highlighting functions */
    update(text) {
        if (!this.template)
            return;
        if (this.value != text)
            this.value = text; // Change value attribute if necessary.
        if (this.querySelector("textarea").value != text)
            this.querySelector("textarea").value = text;
        let result_element = this.querySelector("pre code");
        // Handle final newlines (see article)
        if (text[text.length - 1] == "\n") {
            text += " ";
        }
        // Update code
        result_element.innerHTML = this.escape_html(text);
        this.plugin_evt("beforeHighlight");
        // Syntax Highlight
        if (this.template.includeCodeInputInHighlightFunc)
            this.template.highlight(result_element, this);
        else
            this.template.highlight(result_element);
        this.plugin_evt("afterHighlight");
    }
    sync_scroll() {
        /* Scroll result to scroll coords of event - sync with textarea */
        let input_element = this.querySelector("textarea");
        let result_element = this.template.preElementStyled ? this.querySelector("pre") : this.querySelector("pre code");
        // Get and set x and y
        result_element.scrollTop = input_element.scrollTop;
        result_element.scrollLeft = input_element.scrollLeft;
    }
    escape_html(text) {
        return text.replace(new RegExp("&", "g"), "&amp;").replace(new RegExp("<", "g"), "&lt;"); /* Global RegExp */
    }
    /* Get the template for this element or add to the unrecognised template queue. */
    get_template() {
        // Get name of template
        let template_name;
        if (this.getAttribute("template") == undefined) {
            // Default
            template_name = CodeInput.defaultTemplate;
        }
        else {
            template_name = this.getAttribute("template");
        }
        // Get template
        if (template_name in CodeInput.usedTemplates) {
            return CodeInput.usedTemplates[template_name];
        }
        else {
            // Doesn't exist - add to queue
            if (!(template_name in CodeInput.templateQueue)) {
                CodeInput.templateQueue[template_name] = [];
            }
            CodeInput.templateQueue[template_name].push(this);
            return undefined;
        }
    }
    /* Set up element when a template is added */
    setup() {
        this.classList.add("code-input_registered"); // Remove register message
        if (this.template.preElementStyled)
            this.classList.add("code-input_pre-element-styled");
        this.plugin_evt("beforeElementsAdded");
        /* Defaults */
        let lang = this.getAttribute("lang");
        let placeholder = this.getAttribute("placeholder") || this.getAttribute("lang") || "";
        let value = this.value || this.innerHTML || "";
        this.innerHTML = ""; // Clear Content
        /* Create Textarea */
        let textarea = document.createElement("textarea");
        textarea.placeholder = placeholder;
        textarea.value = value;
        textarea.setAttribute("spellcheck", "false");
        if (this.getAttribute("name")) {
            textarea.setAttribute("name", this.getAttribute("name")); // for use in forms
            this.removeAttribute("name");
        }
        textarea.setAttribute("oninput", "this.parentElement.update(this.value); this.parentElement.sync_scroll();");
        textarea.setAttribute("onscroll", "this.parentElement.sync_scroll();");
        this.append(textarea);
        /* Create pre code */
        let code = document.createElement("code");
        let pre = document.createElement("pre");
        pre.setAttribute("aria-hidden", "true"); // Hide for screen readers
        pre.append(code);
        this.append(pre);
        if (this.template.isCode) {
            if (lang != undefined && lang != "") {
                code.classList.add("language-" + lang);
            }
        }
        this.plugin_evt("afterElementsAdded");
        // Events
        textarea = this.querySelector("textarea");
        // Add event listeners, bound so `this` can be referenced
        this.transfer_event("change", this.querySelector("textarea"), null, this.onchange);
        this.transfer_event("selectionchange", this.querySelector("textarea"), null, this.onselectionchange);
        /* Add code from value attribute - useful for loading from backend */
        this.update(value);
    }
    /* Callbacks */
    connectedCallback() {
        // Added to document
        this.template = this.get_template();
        if (this.template != undefined)
            this.setup();
    }
    attributeChangedCallback(name, oldValue, newValue) {
        if (this.isConnected) {
            // This will sometimes be called before the element has been created, so trying to update an attribute causes an error.
            // Thanks to Kevin Loughead for pointing this out.
            this.plugin_evt("attributeChanged", [name, oldValue, newValue]); // Plugin event
            switch (name) {
                case "value":
                    // Update code
                    this.update(newValue);
                    break;
                case "placeholder":
                    this.querySelector("textarea").placeholder = newValue;
                    break;
                case "template":
                    this.template = CodeInput.usedTemplates[newValue || CodeInput.defaultTemplate];
                    if (this.template) {
                        if (this.template.preElementStyled)
                            this.classList.add("code-input_pre-element-styled");
                        else
                            this.classList.remove("code-input_pre-element-styled");
                        // Syntax Highlight
                        this.update(this.value);
                    }
                    break;
                case "lang":
                    let code = this.querySelector("pre code");
                    let main_textarea = this.querySelector("textarea");
                    // Case insensitive
                    oldValue = oldValue.toLowerCase();
                    newValue = newValue.toLowerCase();
                    // Remove old language class and add new
                    console.log("code-input: Language: REMOVE", "language-" + oldValue);
                    code.classList.remove("language-" + oldValue); // From CODE
                    code.parentElement.classList.remove("language-" + oldValue); // From PRE
                    code.classList.remove("language-none"); // Prism
                    code.parentElement.classList.remove("language-none"); // Prism
                    if (newValue != undefined && newValue != "") {
                        code.classList.add("language-" + newValue);
                        console.log("code-input: Language:ADD", "language-" + newValue);
                    }
                    if (main_textarea.placeholder == oldValue)
                        main_textarea.placeholder = newValue;
                    this.update(this.value);
                    break;
                // Events
                case "onchange":
                    this.transfer_event("change", this.querySelector("textarea"), oldValue, newValue);
                    break;
                case "onselectionchange":
                    this.transfer_event("selectionchange", this.querySelector("textarea"), oldValue, newValue);
                    break;
            }
        }
    }
    /* Transfer an event by name from this to an inner element. */
    transfer_event(evt_name, transfer_to, oldValue, newValue) {
        // Doesn't exist
        if (oldValue) {
            transfer_to.removeEventListener(evt_name, this.last_events[evt_name]);
        }
        if (newValue) {
            this.last_events[evt_name] = this.onchange.bind(this);
            transfer_to.addEventListener(evt_name, this.last_events[evt_name]);
            this[`on${evt_name}`] = undefined; // Prevent duplicate
        }
    }
    /* Value attribute */
    get value() {
        return this.getAttribute("value");
    }
    set value(val) {
        this.setAttribute("value", val);
    }
    /* Placeholder attribute */
    get placeholder() {
        return this.getAttribute("placeholder");
    }
    set placeholder(val) {
        this.setAttribute("placeholder", val);
    }
    set selectionStart(val) { this.querySelector("textarea").selectionStart = val; }
    get selectionStart() { return this.querySelector("textarea").selectionStart; }
    set selectionEnd(val) { this.querySelector("textarea").selectionEnd = val; }
    get selectionEnd() { return this.querySelector("textarea").selectionEnd; }
    get rawTextArea() { return this.querySelector("textarea"); }
    static registerTemplate(template_name, template) {
        // Set default class
        CodeInput.usedTemplates[template_name] = template;
        // Add elements w/ template from queue
        if (template_name in CodeInput.templateQueue) {
            for (let i in CodeInput.templateQueue[template_name]) {
                let elem = CodeInput.templateQueue[template_name][i];
                elem.template = template;
                elem.setup();
            }
            console.log(`code-input: template: Added existing elements with template ${template_name}`);
        }
        if (CodeInput.defaultTemplate == undefined) {
            CodeInput.defaultTemplate = template_name;
            // Add elements w/ default template from queue
            if ("" in CodeInput.templateQueue) {
                for (let i in CodeInput.templateQueue[""]) {
                    let elem = CodeInput.templateQueue[""][i];
                    elem.template = template;
                    elem.setup();
                }
            }
            console.log(`code-input: template: Set template ${template_name} as default`);
        }
        console.log(`code-input: template: Created template ${template_name}`);
    }
}
CodeInput.observedAttributes = [
    "value",
    "placeholder",
    "lang",
    "template",
    "onchange",
    "onselectionchange"
];
CodeInput.usedTemplates = {};
CodeInput.templateQueue = {};
export class Plugin {
    constructor(observedAttributes) {
        console.log("code-input: plugin: Created plugin!");
        // Add attributes
        CodeInput.observedAttributes = CodeInput.observedAttributes.concat(observedAttributes);
    }
    /* Runs before code is highlighted; Params: codeInput element) */
    beforeHighlight(codeInput) { }
    /* Runs after code is highlighted; Params: codeInput element) */
    afterHighlight(codeInput) { }
    /* Runs before elements are added into a `code-input`; Params: codeInput element) */
    beforeElementsAdded(codeInput) { }
    /* Runs after elements are added into a `code-input` (useful for adding events to the textarea); Params: codeInput element) */
    afterElementsAdded(codeInput) { }
    /* Runs when an attribute of a `code-input` is changed (you must add the attribute name to observedAttributes); Params: codeInput element, name attribute name, oldValue previous value of attribute, newValue changed value of attribute) */
    attributeChanged(codeInput, name, oldValue, newValue) { }
}
export class Template {
    constructor(preElementStyled = true, isCode = true, includeCodeInputInHighlightFunc = false, plugins = []) {
        this.preElementStyled = preElementStyled;
        this.isCode = isCode;
        this.includeCodeInputInHighlightFunc = includeCodeInputInHighlightFunc;
        this.plugins = plugins;
    }
    highlight(result_element, code_input) {
    }
}
export class CustomTemplate extends Template {
    constructor(highlight = function () { }, preElementStyled = true, isCode = true, includeCodeInputInHighlightFunc = false, plugins = []) {
        super(preElementStyled, isCode, includeCodeInputInHighlightFunc, plugins);
        this._highlight = highlight;
    }
    highlight(result_element, code_input) {
        this._highlight(result_element, code_input);
    }
}
export class CharacterLimit extends Template {
    constructor() {
        super(true, true, false, []);
    }
    highlight(result_element, code_input) {
        let character_limit = Number(code_input.getAttribute("data-character-limit"));
        let normal_characters = code_input.escape_html(code_input.value.slice(0, character_limit));
        let overflow_characters = code_input.escape_html(code_input.value.slice(character_limit));
        result_element.innerHTML = `${normal_characters}<mark class="overflow">${overflow_characters}</mark>`;
        if (overflow_characters.length > 0) {
            result_element.innerHTML += ` <mark class="overflow-msg">${code_input.getAttribute("data-overflow-msg") || "(Character limit reached)"}</mark>`;
        }
    }
}
export class RainbowText extends Template {
    constructor(rainbow_colors = ["red", "orangered", "orange", "goldenrod", "gold", "green", "darkgreen", "navy", "blue", "magenta"], delimiter = "", plugins = []) {
        super(true, true, true, plugins);
        this.rainbow_colors = rainbow_colors;
        this.delimiter = delimiter;
    }
    highlight(result_element, code_input) {
        let html_result = [];
        let sections = code_input.value.split(this.delimiter);
        for (let i = 0; i < sections.length; i++) {
            html_result.push(`<span style="color: ${this.rainbow_colors[i % this.rainbow_colors.length]}">${code_input.escape_html(sections[i])}</span>`);
        }
        result_element.innerHTML = html_result.join(this.delimiter);
    }
}
customElements.define("code-input", CodeInput); // resgister custom
//# sourceMappingURL=code-input.js.map