import { regHelp } from "../main.js";
regHelp([
	{title:"Split(delim?)",content:"Splits the input stream into an array, divided by the delimiter.\n\nIf not passed, the delimiter is \"\n\".",type:"function"},
	{title:"Join(delim?)",content:"Join the input stream array or strings into a single string, with the delimiter inbetween each value.\n\nIf not passed, the delimiter is \"\n\".",type:"function"},
	{title:"concat(array)",content:"Append the input stream array with additional array nodes.",type:"function"},
	{title:"replace(search, replacement)",content:"Search the input stream string for specific strings, and return the original stream where each search term is swapped for the replacement string.",type:"function"},
	{title:"piece(delim, pieceNum)",content:"Given a string where the text is delimited by the delim string, returns the piece at the pieceNum index. Piece 1 is the first piece (or whole string if the dlimiter is not present).",type:"function"},
	{title:"at(idx)",content:"Given an input array stream, return the individual elemnt at the specified index.",type:"function"},
	{title:"length()",content:"Returns the length of the input stream array.",type:"function"},
	{title:"contains(search)",content:"Returns true or false whether the input stream string contains the search substring.",type:"function"},
	{title:"startsWith(search)",content:"Returns true or false whether the input stream string begins with the search substring.",type:"function"},
	{title:"endsWith(search)",content:"Returns true or false whether the input stream string ends with the search substring.",type:"function"},
	{title:"trim()",content:"Trims whitespace characters from the start and end of the input stream string.",type:"function"},
	{title:"trimStart()",content:"Trims whitespace characters from the start of the input stream string.",type:"function"},
	{title:"trimEnd()",content:"Trims whitespace characters from the start of the input stream string.",type:"function"},
	{title:"modulo(by)",content:"Performs a modulo operation from an input number. When the input stream number is negative, this is different than the remainder. This will always return a positive number.\n\na << -3\n\na:modulo(10) // 7",type:"function"},
	{title:"slice(start, end?)",content:"Return a portion of the array or string where start and end represent the index of the array or characters in the string.\n\nStart is the first index used. If end is not passed, the remainder is returned. Otherwise, each element up to the end is returned.\n\n\"abcde\":slice(2) // \"cde\"\n\n\"abcde\":slice(1,3) // \"bc\"",type:"function"},
	{title:"flatten()",content:"Given an array stream where each element is an array, joins the inner contents into a single array of all elements.\n\n[[1,2],[3,4,5]]:flatten // [1,2,3,4,5]",type:"function"},
	{title:"iif(test, trueVal, falseVal?)",content:"Given a boolean result as a test, executes and returns either the true or false path.\n\nIf falseVal is not passed, the default is the incoming stream.\n\niif(3 > 2, \"a\", \"b\") // \"a\"\n\nNote: the path not needed is not executed, so errors in the unused path do not halt the program.",type:"function"},
	{title:"tryParseNum()",content:"Attempt to parse the input string stream into a real number that math can be performed on.\n\n\"1.0\":tryParseNum // 1",type:"function"},
	{title:"keys()",content:"Given a map as the input stream, returns an array of keys of the map.\n\nGiven an array, returns the keys of the array ([0,1,2,...]).",type:"function"}
]);