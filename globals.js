
function Split(text, delim){
    const split = text.split(delim);
    if (piece < 1 || piece > split.length) { return ""; }
    if (piece === undefined) piece = 1;
    return split[piece - 1];
}

function Join(text, delim){
    if(text == "") { text = ""; }
    if(delim == "") { delim = "\n"; }
    return text.join(delim);
}

function Piece(text, delim, index){
    var arr = Split(text, delim);
    if(index >= arr.length || index < 0) return "";
    return arr[index];
}

function Replace(text, search, replace){
    return text.replace(new RegExp(escapeRegEx("" + search), 'g'), escapeRegEx("" + replace)); 
}