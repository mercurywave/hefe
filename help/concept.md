## Concepts
These concepts help explain how to use hefe

### Writing Functions
You can write functions to reuse chunks of code with different parameters. Functions operate on the stream they are passed in, and return a modified stream. They can have additional parameters to control their behavior.

You can declare a function like, anywhere in your code. The indented lines below the function definition are the function body. The function contents are not executed until the function is called.

function Foo(val)
    replace("a", val)
    replace("b", val)

You can then call this function from your code like this:

"Call a cab":Foo("?")
// outputs "C?ll ? c??"

### Variables
You can save the contents of a stream to a variable to be reused later. Variables can be named arbitrarily, but must start with a letter and constist of a single word that is not also a function. Variables declared within a scope, such as a map, are private to each parallel stream and closed when the scope closes. Variables at the top level can be seen in the output window under different tabs.

[1,2,3]
myVar << stream // saves [1,2,3] to the variable myVar

The right hand operation is not committed to the stream, so you can save off output without modifying the stream.

myVar << [1,2,3] // saves the array to the variable, but the stream from the previous line is left alone

You can instead use >> to save the stream to a variable at the other end of a statement, as a style preference. For example:

[1,2,3] >> myVar

### Chaining Functions
Sometimes it is useful to take a value and execute additional work on it before moving on without dividing the work on multiple lines.

Instead of this:
" 1, 2, 3, 4;"
trim
replace(";","")
split(", ")

You can do this as part of a single expression with the ':' operator:
" 1, 2, 3, 4;":trim:replace(";",""):split(", ")

You can compose these complex expressions inside other expressions.

Scope functions like map are a special case, because they have an inner scope on subsequent lines. You can compose using these functions, but only one such scoped function is available on a single line, and you must use '::' instead to denote this.

[1,2,3] :: map :: join(",")
    stream + 1
// outputs "2,3,4"

### Folder Processing
Once you have a processing script you're happy with, you can use that to apply to process multiple files in a folder.

Specify a folder by pressing the Load Folder button. Nothing happens immediately once you select a folder, as you have to define how you want to process that data.

You can use the getFiles command to get a list of all the files in the folder. Then you can filter that list using your typical tools. You can then specify to load those files as text using the loadFile command for each file name you want to load.

getFiles
map
    loadFile