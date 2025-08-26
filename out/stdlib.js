import { regFunc } from "./parser.js";
import { Stream } from "./stream.js";
regFunc("split", 0, 1, ["delim"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot split stream - expected string";
    let delim = "\n";
    if (pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkArr(stream.text.split(delim).map(s => new Stream(s)));
});
regFunc("join", 0, 1, ["delim"], async (c, stream, pars) => {
    if (!stream.isArray)
        throw "cannot join stream - expected array";
    let delim = "\n";
    if (pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkText(stream.array.map(s => s.asString()).join(delim));
});
regFunc("concat", 1, 1, ["array"], async (c, stream, pars) => {
    if (!stream.isArray)
        throw "cannot concat stream - expected array";
    let tail = (await pars[0].Eval(c, c.stream)).asArray();
    return Stream.mkArr(stream.array.concat(tail));
});
regFunc("replace", 2, 2, ["target", "replacement"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot replace in stream - expected string";
    const target = await pars[0].EvalAsText(c);
    const replace = await pars[1].EvalAsText(c);
    return Stream.mkText(stream.text.replaceAll(target, replace));
});
regFunc("piece", 2, 2, ["delim", "pieceNum"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot piece stream - expected string";
    const delim = await pars[0].EvalAsText(c);
    const idx = (await pars[1].Eval(c, c.stream)).asNum();
    const split = stream.asString().split(delim);
    return Stream.mkText(split[idx - 1]);
});
regFunc("at", 1, 1, ["index"], async (c, stream, pars) => {
    const idx = (await pars[0].Eval(c, c.stream));
    return stream.getChild(idx);
});
regFunc("length", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isArray && !stream.isText)
        throw "cannot count length of stream - expected array or string";
    if (stream.isText)
        return Stream.mkNum(stream.asString().length);
    return Stream.mkNum(stream.asArray().length);
});
regFunc("contains", 1, 1, ["search"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot check stream for substring contains - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.includes(target));
});
regFunc("startsWith", 1, 1, ["search"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot check stream for startsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.startsWith(target));
});
regFunc("endsWith", 1, 1, ["search"], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot check stream for endsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.endsWith(target));
});
regFunc("toLower", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw "toLower expects string";
    return Stream.mkText(stream.text.toLowerCase());
});
regFunc("toUpper", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw "toUpper expects string";
    return Stream.mkText(stream.text.toUpperCase());
});
regFunc("trim", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot trim stream - expected string";
    return Stream.mkText(stream.text.trim());
});
regFunc("trimStart", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot trimStart stream - expected string";
    return Stream.mkText(stream.text.trimStart());
});
regFunc("trimEnd", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw "cannot trimEnd stream - expected string";
    return Stream.mkText(stream.text.trimEnd());
});
regFunc("modulo", 1, 1, ["by"], async (c, stream, pars) => {
    if (!stream.isNum)
        throw "cannot modulo stream - expected number";
    const m = (await pars[0].Eval(c, c.stream)).asNum();
    return Stream.mkNum(((stream.num % m) + m) % m);
});
regFunc("slice", 1, 2, ["start", "end"], async (c, stream, pars) => {
    if (!stream.isText && !stream.isArray)
        throw "cannot slice stream - expected string or array";
    const start = (await pars[0].Eval(c, c.stream)).asNum();
    let end = undefined;
    if (pars.length > 1)
        end = (await pars[1].Eval(c, c.stream)).asNum();
    if (stream.isText)
        return Stream.mkText(stream.asString().slice(start, end));
    return Stream.mkArr(stream.asArray().slice(start, end));
});
regFunc("flatten", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isArray)
        throw "cannot flatten stream - expected array of arrays";
    return Stream.mkArr(stream.asArray().map(s => {
        if (s.isArray)
            return s.asArray();
        if (s.isMap)
            return s.mapToPairsArr();
        return s;
    }).flat());
});
regFunc("iif", 2, 3, ["test", "trueVal", "falseVal"], async (c, stream, pars) => {
    const test = (await pars[0].Eval(c, c.stream)).asBool();
    if (test) {
        return await pars[1].Eval(c, c.stream);
    }
    if (pars.length > 2)
        return await pars[2].Eval(c, c.stream);
    return stream;
});
regFunc("tryParseNum", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        return stream;
    const text = stream.asString();
    const flo = parseFloat(text);
    if (isNaN(flo))
        return stream;
    return Stream.mkNum(flo);
});
regFunc("keys", 0, 0, [], async (c, stream, pars) => {
    if (stream.isMap) {
        let arr = [];
        for (let key of stream.asMap().keys()) {
            arr.push(Stream.fromRaw(key));
        }
        return Stream.mkArr(arr);
    }
    else if (stream.isArray) {
        let arr = stream.asArray();
        return Stream.mkArr(arr.map((v, i) => Stream.mkNum(i)));
    }
    else
        throw 'stream does not contain keys';
});
regFunc("values", 0, 0, [], async (c, stream, pars) => {
    if (stream.isMap) {
        let arr = [];
        for (let value of stream.asMap().values()) {
            arr.push(value);
        }
        return Stream.mkArr(arr);
    }
    else
        throw 'expected map';
});
regFunc("range", 2, 3, ["min", "max", "by"], async (c, stream, pars) => {
    let min = (await pars[0].Eval(c, stream)).asNum();
    let max = (await pars[1].Eval(c, stream)).asNum();
    let by = 1;
    if (pars.length > 2)
        by = (await pars[2].Eval(c, stream)).asNum();
    let arr = [];
    if (by > 0)
        for (let i = min; i <= max; i += by)
            arr.push(Stream.mkNum(i));
    else if (by < 0)
        for (let i = max; i >= min; i += by)
            arr.push(Stream.mkNum(i));
    else
        throw new Error("range by value cannot by 0");
    return Stream.mkArr(arr);
});
regFunc("parseJson", 0, 0, [], async (c, stream, pars) => {
    if (!stream.isText)
        throw new Error('parseJson expected a string');
    const text = stream.asString();
    try {
        const obj = JSON.parse(text);
        return Stream.fromObj(obj);
    }
    catch (e) {
        throw new Error(`parseJson failed: ${e}`);
    }
});
regFunc("toJson", 0, 1, ["prettify"], async (c, stream, pars) => {
    let pretty = false;
    if (pars.length > 0)
        pretty = (await pars[0].Eval(c, stream)).asBool();
    try {
        return Stream.mkText(JSON.stringify(stream.toObj(), null, pretty ? 2 : 0));
    }
    catch (e) {
        throw new Error(`parseJson failed: ${e}`);
    }
});
regFunc("jsEx", 1, 1, ["jsCode"], async (c, stream, pars) => {
    let code = (await pars[0].Eval(c, stream)).asString();
    try {
        const func = new Function('stream', `return ${code};`);
        return Stream.fromRaw(await func(stream.toRaw()));
    }
    catch (e) {
        throw new Error(`jsCode error: ${e}`);
    }
});
regFunc("reMatchAll", 1, 2, ["regExp"], async (c, stream, pars) => {
    let code = (await pars[0].Eval(c, stream)).asString();
    let caseInsensitve = false;
    if (pars.length > 1)
        caseInsensitve = (await pars[1].Eval(c, stream)).asBool();
    try {
        const regex = new RegExp(code, "g" + (caseInsensitve ? 'i' : ''));
        return Stream.mkArr((stream.asString().match(regex) || []).map(i => Stream.mkText(i)));
    }
    catch (e) {
        throw new Error(`regex error: ${e}`);
    }
});
regFunc("reContains", 1, 2, ["regExp"], async (c, stream, pars) => {
    let code = (await pars[0].Eval(c, stream)).asString();
    let caseInsensitve = false;
    if (pars.length > 1)
        caseInsensitve = (await pars[1].Eval(c, stream)).asBool();
    try {
        const regex = new RegExp(code, (caseInsensitve ? 'i' : ''));
        return Stream.mkBool(stream.asString().search(regex) >= 0);
    }
    catch (e) {
        throw new Error(`regex error: ${e}`);
    }
});
regFunc("reReplaceAll", 1, 3, ["regExp"], async (c, stream, pars) => {
    let code = (await pars[0].Eval(c, stream)).asString();
    let caseInsensitve = false;
    let repl = "";
    if (pars.length > 1)
        repl = (await pars[1].Eval(c, stream)).asString();
    if (pars.length > 2)
        caseInsensitve = (await pars[2].Eval(c, stream)).asBool();
    try {
        const regex = new RegExp(code, "g" + (caseInsensitve ? 'i' : ''));
        return Stream.mkText(stream.asString().replace(regex, repl));
    }
    catch (e) {
        throw new Error(`regex error: ${e}`);
    }
});
regFunc("reSplit", 1, 2, ["regExp"], async (c, stream, pars) => {
    let code = (await pars[0].Eval(c, stream)).asString();
    let caseInsensitve = false;
    if (pars.length > 1)
        caseInsensitve = (await pars[1].Eval(c, stream)).asBool();
    try {
        const regex = new RegExp(code, "g" + (caseInsensitve ? 'i' : ''));
        return Stream.mkArr((stream.asString().split(regex) || []).map(i => Stream.mkText(i)));
    }
    catch (e) {
        throw new Error(`regex error: ${e}`);
    }
});
regFunc("sideOutput", 0, 1, ["name"], async (c, stream, pars) => {
    let name = "";
    if (pars.length > 0)
        name = (await pars[0].Eval(c, stream)).asString();
    try {
        const invalidChars = /[\\\/:*?"<>|\n\r\t]/; // disallow common problem characters
        if (invalidChars.test(name))
            throw new Error(`${name} is not a valid file name`);
        c.saveSideOut(name, stream);
        return stream;
    }
    catch (e) {
        throw new Error(`sideOutput: ${e}`);
    }
});
regFunc("getFiles", 0, 0, [], async (c, stream, pars) => {
    try {
        let folder = c.selectedFolder;
        const fileNames = [];
        if (folder) {
            for (const [name, handle] of await folder.entries()) {
                if (handle.kind === 'file') {
                    fileNames.push(Stream.mkText(name));
                }
            }
        }
        else {
            for (const [name, value] of Object.entries(c.originalInput.variables)) {
                fileNames.push(Stream.mkText(name));
            }
        }
        return Stream.mkArr(fileNames);
    }
    catch (e) {
        throw new Error(`getFilesInFolder: ${e}`);
    }
});
regFunc("loadFile", 0, 0, [], async (c, stream, pars) => {
    try {
        return await getFileTextOrInput(c, stream.asString());
    }
    catch (e) {
        throw new Error(`getFilesInFolder: ${e}`);
    }
});
async function getFileTextOrInput(c, fileName) {
    let folder = c.selectedFolder;
    if (folder) {
        let handle = await folder.getFileHandle(fileName);
        let content = await handle?.getFile();
        if (content) {
            let text = await content.text();
            return Stream.mkText(text);
        }
    }
    else {
        for (const [name, value] of Object.entries(c.originalInput.variables)) {
            if (name === fileName) {
                return Stream.mkText(value);
            }
        }
    }
    return Stream.mkText("");
}
//# sourceMappingURL=stdlib.js.map