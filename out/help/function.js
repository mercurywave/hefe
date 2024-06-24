import { regHelp } from "../main.js";
regHelp([
    { title: "Split(delim?)", content: "Splits the input stream into an array, divided by the delimiter.\n\nIf not passed, the delimiter is \"\n\".", type: "function" },
    { title: "Join(delim?)", content: "Join the input stream array or strings into a single string, with the delimiter inbetween each value.\n\nIf not passed, the delimiter is \"\n\".", type: "function" },
    { title: "concat(array)", content: "Append the input stream array with additional array nodes.", type: "function" },
    { title: "replace(search, replacement)", content: "Search the input stream string for specific strings, and return the original stream where each search term is swapped for the replacement string.", type: "function" },
    { title: "piece(delim, pieceNum)", content: "Given a string where the text is delimited by the delim string, returns the piece at the pieceNum index. Piece 1 is the first piece (or whole string if the dlimiter is not present).", type: "function" },
    { title: "at(idx)", content: "Given an input array stream, return the individual elemnt at the specified index.", type: "function" },
    { title: "length()", content: "If the input string is an array, this returns the number of elements. If the input is a string, this returns the number of characters.", type: "function" },
    { title: "contains(search)", content: "Returns true or false whether the input stream string contains the search substring.", type: "function" },
    { title: "startsWith(search)", content: "Returns true or false whether the input stream string begins with the search substring.", type: "function" },
    { title: "endsWith(search)", content: "Returns true or false whether the input stream string ends with the search substring.", type: "function" },
    { title: "trim()", content: "Trims whitespace characters from the start and end of the input stream string.", type: "function" },
    { title: "trimStart()", content: "Trims whitespace characters from the start of the input stream string.", type: "function" },
    { title: "trimEnd()", content: "Trims whitespace characters from the start of the input stream string.", type: "function" },
    { title: "modulo(by)", content: "Performs a modulo operation from an input number. When the input stream number is negative, this is different than the remainder. This will always return a positive number.\n\na << -3\n\na:modulo(10) // 7", type: "function" },
    { title: "slice(start, end?)", content: "Return a portion of the array or string where start and end represent the index of the array or characters in the string.\n\nStart is the first index used. If end is not passed, the remainder is returned. Otherwise, each element up to the end is returned.\n\n\"abcde\":slice(2) // \"cde\"\n\n\"abcde\":slice(1,3) // \"bc\"", type: "function" },
    { title: "flatten()", content: "Given an array stream where each element is an array, joins the inner contents into a single array of all elements.\n\n[[1,2],[3,4,5]]:flatten // [1,2,3,4,5]", type: "function" },
    { title: "iif(test, trueVal, falseVal?)", content: "Given a boolean result as a test, executes and returns either the true or false path.\n\nIf falseVal is not passed, the default is the incoming stream.\n\niif(3 > 2, \"a\", \"b\") // \"a\"\n\nNote: the path not needed is not executed, so errors in the unused path do not halt the program.", type: "function" },
    { title: "tryParseNum()", content: "Attempt to parse the input string stream into a real number that math can be performed on.\n\n\"1.0\":tryParseNum // 1", type: "function" },
    { title: "keys()", content: "Given a map as the input stream, returns an array of keys of the map.\n\nGiven an array, returns the keys of the array ([0,1,2,...]).", type: "function" },
    { title: "sortBy", content: "This subroutine takes an array. For each element, you give the element a score via the inner scope, and the final output will be sorted by the score you gave it. Higher scores will sort to a higher index.\n\n[\"ccc\", \"bb\", \"a\", \"dddd\"]\nsortBy\n	length \n// [\"a\", \"bb\", \"ccc\", \"dddd\"]\n\n// TODO: this doesn't work\n[4,3,1,2]\nsortBy \n// [1,2,3,4]", type: "function" },
    { title: "sumBy", content: "This subroutine takes an array. For each element, you give the element a score via the inner scope. The final output is the total of all scores.\n\n[\"ccc\", \"bb\", \"a\", \"dddd\"]\nsortBy\n	length \n// [\"a\", \"bb\", \"ccc\", \"dddd\"]", type: "function" },
    { title: "map", content: "This subroutine expects an array. Each element of the array is processed by the inner scope, with that processing being returned into an array at the end.\n\n[1,2,3,4]\nmap\n    stream + 1\n// [2,3,4,5]", type: "function" },
    { title: "filter", content: "This subroutine has you evaluate each element in the inner scope. For each element, process a boolean value to determine whether the element should be included in the final output.\n\n[1,2,3,4,5]\nfilter\n    modulo(2) = 0\n// [2,4]", type: "function" },
    { title: "pivot", content: "Given an array, create a map that groups elements into a map. In the inner scope, calculate a key which will be used for clustering.\n\n[1,2,3,4,5]\npivot\n    modulo(2)\n//{\n//  0 : [2,4],\n//  1 : [1,3,5]\n//}", type: "function" },
    { title: "do", content: "This subroutine simply passes through the input and outputs the work of the inner scope. It might be useful for code organization in some cases.", type: "function" },
    { title: "exit", content: "Halts script execution immediately, similar to entering debug mode on a line.", type: "function" }
]);
//# sourceMappingURL=function.js.map