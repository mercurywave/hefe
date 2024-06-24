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
Returns the length of the input stream array.

### contains(search)
Returns true or false whether the input stream string contains the search substring.

### startsWith(search)
Returns true or false whether the input stream string begins with the search substring.

### endsWith(search)
Returns true or false whether the input stream string ends with the search substring.

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