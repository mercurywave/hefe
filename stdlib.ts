import { regFunc } from "./parser.js";
import { Stream } from "./stream.js";


regFunc("split", 0, 1, ["delim"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot split stream - expected string";
    let delim = "\n";
    if(pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkArr(stream.text.split(delim).map(s => new Stream(s)));
});

regFunc("join", 0, 1, ["delim"], async (c, stream, pars) =>{
    if(!stream.isArray) throw "cannot join stream - expected array";
    let delim = "\n";
    if(pars.length > 0)
        delim = await pars[0].EvalAsText(c);
    return Stream.mkText(stream.array.map(s => s.asString()).join(delim));
});

regFunc("concat", 1, 1, ["array"], async (c, stream, pars) =>{
    if(!stream.isArray) throw "cannot concat stream - expected array";
    let tail = (await pars[0].Eval(c, c.stream)).asArray();
    return Stream.mkArr(stream.array.concat(tail));
});

regFunc("replace", 2, 2, ["target", "replacement"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot replace in stream - expected string";
    const target = await pars[0].EvalAsText(c);
    const replace = await pars[1].EvalAsText(c);
    return Stream.mkText(stream.text.replaceAll(target, replace));
});

regFunc("piece", 2, 2, ["delim", "pieceNum"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot piece stream - expected string";
    const delim = await pars[0].EvalAsText(c);
    const idx = (await pars[1].Eval(c, c.stream)).asNum();
    const split = stream.asString().split(delim);
    return Stream.mkText(split[idx - 1]);
});

regFunc("at", 1, 1, ["index"], async (c, stream, pars) =>{
    const idx = (await pars[0].Eval(c, c.stream));
    if(stream.isMap) {
        const key = idx.toKey();
        return stream.asMap().get(key) ?? new Stream();
    }
    if(!stream.isArray) throw "cannot access stream array element - expected array";
    return stream.asArray()[idx.asNum()];
});

regFunc("length", 0, 0, [], async (c, stream, pars) => {
    if(!stream.isArray) throw "cannot count length of stream - expected array";
    return Stream.mkNum(stream.asArray().length);
});

regFunc("contains", 1, 1, ["search"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for substring contains - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.includes(target));
});
regFunc("startsWith", 1, 1, ["search"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for startsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.startsWith(target));
});
regFunc("endsWith", 1, 1, ["search"], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot check stream for endsWith - expected string";
    const target = await pars[0].EvalAsText(c);
    return Stream.mkBool(stream.text.endsWith(target));
});

regFunc("trim", 0, 0, [], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trim stream - expected string";
    return Stream.mkText(stream.text.trim());
});
regFunc("trimStart", 0, 0, [], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trimStart stream - expected string";
    return Stream.mkText(stream.text.trimStart());
});
regFunc("trimEnd", 0, 0, [], async (c, stream, pars) =>{
    if(!stream.isText) throw "cannot trimEnd stream - expected string";
    return Stream.mkText(stream.text.trimEnd());
});

regFunc("modulo", 1, 1, ["by"], async (c, stream, pars) =>{
    if(!stream.isNum) throw "cannot modulo stream - expected number";
    const m = (await pars[0].Eval(c, c.stream)).asNum();
    return Stream.mkNum(((stream.num % m) + m) % m);
});

regFunc("slice", 1, 2, ["start", "end"], async (c, stream, pars) =>{
    if(!stream.isText && !stream.isArray) throw "cannot slice stream - expected string or array";
    const start = (await pars[0].Eval(c, c.stream)).asNum();
    let end = null;
    if(pars.length > 1) end = (await pars[1].Eval(c, c.stream)).asNum();
    if(stream.isText)
        return Stream.mkText(stream.asString().slice(start, end));
    return Stream.mkArr(stream.asArray().slice(start, end));
});

regFunc("flatten", 0, 0, [], async (c, stream, pars) =>{
    if(!stream.isArray) throw "cannot flatten stream - expected array of arrays";
    return Stream.mkArr(stream.asArray().map(s => {
        if(s.isArray) return s.asArray();
        if(s.isMap) return s.mapToPairsArr();
        return s;
    }).flat());
});

regFunc("iif", 2, 3, ["test", "trueVal", "falseVal"], async (c, stream, pars) =>{
    const test = (await pars[0].Eval(c, c.stream)).asBool();
    if(test){
        return await pars[1].Eval(c, c.stream);
    }
    if(pars.length > 2) return await pars[2].Eval(c, c.stream);
    return stream;
});

regFunc("tryParseNum", 0, 0, [], async (c, stream, pars) =>{
    if(!stream.isText) return stream;
    const text = stream.asString();
    const flo = parseFloat(text);
    if (isNaN(flo)) return stream;
    return Stream.mkNum(flo);
});

regFunc("keys", 0, 0, [], async (c, stream, pars) => {
    if(stream.isMap){
        let arr : Stream[] = [];
        for(let key of stream.asMap().keys()){
            arr.push(Stream.fromRaw(key));
        }
        return Stream.mkArr(arr);
    }
    else if(stream.isArray){
        let arr = stream.asArray();
        return Stream.mkArr(arr.map((v,i) => Stream.mkNum(i)));
    }
    else throw 'stream does not contain keys';
});