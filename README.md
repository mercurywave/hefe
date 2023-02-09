# Hefe

A lightweight interactive text parsing and manipulation tool.

[Try it out on GitHub Pages](https://mercurywave.github.io/hefe/)

## Scripting

Hefe uses a functional scripting language to make it easy to manipulate data. Each command operates on an ongoing stream of data, manipulating it for the next step.

## Example

```ts
split // split each line of the input text into an array of individual strings
map // run these commands on each line
    replace("|", ",") // replace | with ,
filter // check each line for a condition
    contains("Yes") // if the line doesn't contain "Yes", exclude it
Join // join all the lines back up
```

## Special Features

### Variables
```ts
a << replace("Y", "N") // save off the right side of << to variable a (does not affect next line)
b << stream // stream is a special variable to refer to the current stream
map
    index // index is a special variable within a scoped command, which contains the current index within the array
```

### Commands
```ts
exit // halt further operations (useful for debugging so you can see what is happeneing at a specific step)

map // run the indented code on each element of the array
filter // runs each element of the array on the indented code
// the output after the indented code is the array from the stream, but with elemnts removed which the inner code returned false

```

### Function
```ts
foo:replace(",","_") // run the replace function on the foo variable instead of using the stream
bar:replace()

replace("a", "b") // replace all "a" characters with "b" in the stream
concat(arr) // append arr onto the current array stream
piece(":", 3) // returns the thir piece in between ":" characters of a string
contains("text") // returns true if the string contains "text"
slice(1, -1) // returns subset of array or substring, similar to the .slice() function in javascript
// (there are a number of other functions)
```

<details>

<summary>

#### Future Ideas (not currently implemented)

</summary>

```ts

:Splitter(delim) // create functions
    SplitEscaped("|", "\|")

pattern Line // some way to define a pattern (that isn't a regex)
    number
    ","
    string
    ","
    or
        escapedString("\"")
        string
    ","

obj << JSONParse() // parse special format easily
obj.lines:split()
```

</details>