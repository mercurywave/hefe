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
// save off the right side of << to variable a (does not affect next line)
a << replace("Y", "N") 

// stream is a special variable to refer to the current stream
b << stream

c << [1,2,3] // creates an array of elements 1, 2, and 3

// index is a special variable within a scoped command
// it contains the current index within the array
map
    index 
```

### Commands
```ts
exit // halt further operations 
// (useful for debugging so you can see what is happeneing at a specific step)

map // run the indented code on each element of the array
filter // runs each element of the array on the indented code
// the output after the indented code is the array from the stream
// however, with the elemnts removed which the inner code returned false

```

### Function
```ts
// run the replace function on the foo variable instead of using the stream
foo:replace(",","_") 
// you can chain multiple functions together this way
bar:replace("Y",""):piece("^", 4)

replace("a", "b") // replace all "a" characters with "b" in the stream
concat(arr) // append arr onto the current array stream
at(4) // access a single element at a specific element
piece(":", 3) // returns the thir piece in between ":" characters of a string
contains("text") // returns true if the string contains "text"
slice(1, -1) // returns subset of array or substring
// (it is similar to the .slice() function in javascript)

iif(c <= 10, "moose") // if c is less or equal to 10, replace the stream with "moose"
iif(d < 4, "foo", "bar") // test for a condition and replace the stream with foo or bar
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