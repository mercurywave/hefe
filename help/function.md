## Functions
These functions are available in Hefe programs.

### Split(delim?)
Splits the input stream into an array, divided by the delimiter.

If not passed, the delimiter is "\n".

### Join(delim?)
Join the input stream array or strings into a single string, with the delimiter inbetween each value.

If not passed, the delimiter is "\n".

### concat(array)
Append the input stream array with additional array nodes.

### replace(search, replacement)
Search the input stream string for specific strings, and return the original stream where each search term is swapped for the replacement string.

### piece(delim, pieceNum)
Given a string where the text is delimited by the delim string, returns the piece at the pieceNum index. Piece 1 is the first piece (or whole string if the dlimiter is not present).

### at(idx)
Given an input array stream, return the individual elemnt at the specified index.

### length()
If the input string is an array, this returns the number of elements. If the input is a string, this returns the number of characters.

### contains(search)
Returns true or false whether the input stream string contains the search substring.

### startsWith(search)
Returns true or false whether the input stream string begins with the search substring.

### endsWith(search)
Returns true or false whether the input stream string ends with the search substring.

### toLower()
Given a string, returns that string with all characters converted to lower case.

### toUpper()
Given a string, returns that string with all characters converted to upper case.

### trim()
Trims whitespace characters from the start and end of the input stream string.

### trimStart()
Trims whitespace characters from the start of the input stream string.

### trimEnd()
Trims whitespace characters from the start of the input stream string.

### modulo(by)
Performs a modulo operation from an input number. When the input stream number is negative, this is different than the remainder. This will always return a positive number.

a << -3

a:modulo(10) // 7

### slice(start, end?)
Return a portion of the array or string where start and end represent the index of the array or characters in the string.

Start is the first index used. If end is not passed, the remainder is returned. Otherwise, each element up to the end is returned.

"abcde":slice(2) // "cde"

"abcde":slice(1,3) // "bc"

### flatten()
Given an array stream where each element is an array, joins the inner contents into a single array of all elements.

[[1,2],[3,4,5]]:flatten // [1,2,3,4,5]

### iif(test, trueVal, falseVal?)
Given a boolean result as a test, executes and returns either the true or false path.

If falseVal is not passed, the default is the incoming stream.

iif(3 > 2, "a", "b") // "a"

Note: the path not needed is not executed, so errors in the unused path do not halt the program.

### tryParseNum()
Attempt to parse the input string stream into a real number that math can be performed on.

"1.0":tryParseNum // 1

### keys()
Given a map as the input stream, returns an array of keys of the map.

Given an array, returns the keys of the array ([0,1,2,...]).

### values()
Given a map as the input stream, returns an array of values of the map, without keys.

### range(min, max, by?)
Creates a new array of numbers from the minimum to the maximum (inclusive).

range(1,3) // [1,2,3]

The 'by' parameter allows to skip values by having each next node iterate by the value of 'by'.

range(1,5,2) // [1,3,5]

A negative 'by' creates an array starting from the maximum down to the minimum.

range(0,4,-2) // [4,2,0]

### parseJson
Takes a string containing JSON and parses it into a map or array, depending on the contents.

### toJson(prettify?)
Converts an object-like stream to a JSON object string. When given a string, this will escape the string for JSON.

The prettify parameter accepts a bool which lets you output the string. The default is false.

### jsEx(code)
This allows you to execute arbitrary javascript code on the input stream. The input code should be a valid expression which evaluates to an output value. The 'stream' variable is availble to the code to execute, and the result is chained forward.

WARNING: As this is a rough prototype, this is a temporary shim, and may be removed in future.

"asdf" : jsEx(`"[" + stream + "]"`) // "[asdf]"

### sortBy
This subroutine takes an array. For each element, you give the element a score via the inner scope, and the final output will be sorted by the score you gave it. Higher scores will sort to a higher index.

["ccc", "bb", "a", "dddd"]
sortBy
	length 
// ["a", "bb", "ccc", "dddd"]

If no inner scope is passed, the array will be sorted by the value of each node.

[4,3,1,2]
sortBy
// [1,2,3,4]

### sumBy
This subroutine takes an array. For each element, you give the element a score via the inner scope. The final output is the total of all scores.

["ccc", "bb", "a", "dddd"]
sortBy
	length 
// ["a", "bb", "ccc", "dddd"]

### map
This subroutine expects an array. Each element of the array is processed by the inner scope, with that processing being returned into an array at the end.

[1,2,3,4]
map
    stream + 1
// [2,3,4,5]

### filter
This subroutine has you evaluate each element in the inner scope. For each element, process a boolean value to determine whether the element should be included in the final output.

[1,2,3,4,5]
filter
    modulo(2) = 0
// [2,4]

### pivot
Given an array, create a map that groups elements into a map. In the inner scope, calculate a key which will be used for clustering.

[1,2,3,4,5]
pivot
    modulo(2)
//{
//  0 : [2,4],
//  1 : [1,3,5]
//}

### do
This subroutine simply passes through the input and outputs the work of the inner scope. It might be useful for code organization in some cases.

### exit
Halts script execution immediately, similar to entering debug mode on a line.